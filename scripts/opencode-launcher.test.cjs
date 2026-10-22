const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-launcher-'));
  try {
    for (const directory of ['scripts', '.opencode/runs', 'usage/data', 'home']) fs.mkdirSync(path.join(root, directory), { recursive: true });
    for (const file of ['run-opencode.cjs', 'usage-ledger.cjs', 'opencode-controls.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(root, 'scripts', file));
    const cli = path.join(root, '.opencode/fake.cjs');
    fs.writeFileSync(cli, `const fs=require('node:fs');fs.appendFileSync('.opencode/invocations.local.txt','run\\n');fs.writeFileSync('.opencode/config.local.json',process.env.OPENCODE_CONFIG_CONTENT||'{}');const emit=e=>process.stdout.write(JSON.stringify(e)+'\\n');const scenario=process.env.LAUNCHER_TEST_SCENARIO;if(scenario==='startup'){setInterval(()=>{},1000);}else if(scenario==='quota'){emit({type:'error',error:{name:'APIError',data:{statusCode:429,responseHeaders:{'retry-after':'120'},message:'FreeUsageLimitError'}}});process.stderr.write('Authorization: Bearer private-fixture-value\\n');process.exitCode=1;}else{emit({type:'step_start',sessionID:'fixture-session'});emit({type:'tool_use',sessionID:'fixture-session',part:{id:'tool-1',tool:'read',state:{status:'completed',output:'Source example: FreeUsageLimitError HTTP 429'}}});emit({type:'step_finish',timestamp:Date.now(),sessionID:'fixture-session',part:{id:'step-1',tokens:{total:10,input:5,output:5,reasoning:0,cache:{read:0,write:0}},cost:0}});if(scenario==='partial'){setInterval(()=>{},1000);}else{emit({type:'text',sessionID:'fixture-session',part:{text:'Validated fixture result'}});}}`);
    fs.writeFileSync(path.join(root, '.opencode/runtime.local.json'), JSON.stringify({ cli, freeModels: ['opencode/big-pickle', 'opencode/mimo-v2.6-flash-free'] }));
    fs.writeFileSync(path.join(root, '.opencode/task.local.txt'), 'Fixture task');
    const now = new Date().toISOString();
    const models = Object.fromEntries(['opencode/big-pickle', 'opencode/mimo-v2.6-flash-free'].map((id) => [id, { status: 'active', cost: { input: 0, output: 0 }, capabilities: { toolcall: true } }]));
    fs.writeFileSync(path.join(root, 'usage/data/catalog.json'), JSON.stringify({ savedAt: now, models }));
    fs.writeFileSync(path.join(root, 'usage/data/catalog-meta.json'), JSON.stringify({ lastStatus: 'ok', chatChecks: { 'fixture-chat': now } }));
    const launch = (scenario, extra = []) => spawnSync(process.execPath, [path.join(root, 'scripts/run-opencode.cjs'), '--repo', 'app', '--agent', 'explore', '--chat', 'fixture-chat', '--prompt-file', path.join(root, '.opencode/task.local.txt'), ...extra], { cwd: root, env: { ...process.env, CODEX_HOME: path.join(root, 'home'), LAUNCHER_TEST_SCENARIO: scenario, OPENCODE_CONFIG_CONTENT: JSON.stringify({ agent: { explore: { tools: { preserved: true } } } }) }, encoding: 'utf8', timeout: 10000, windowsHide: true });
    const receipts = () => fs.readdirSync(path.join(root, '.opencode/runs')).filter((name) => name.endsWith('.receipt.json')).map((name) => JSON.parse(fs.readFileSync(path.join(root, '.opencode/runs', name))));
    run({ root, launch, receipts });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('launcher succeeds with merged step overrides, Big Pickle planning and ledger telemetry', () => fixture(({ root, launch, receipts }) => {
  const result = launch('success', ['--steps', '7']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const [receipt] = receipts();
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.model, 'opencode/big-pickle');
  assert.equal(receipt.error, undefined);
  assert.equal(fs.existsSync(path.join(root, 'usage/data/cooldowns')), false);
  const config = JSON.parse(fs.readFileSync(path.join(root, '.opencode/config.local.json')));
  assert.equal(config.agent.explore.steps, 7);
  assert.equal(config.agent.explore.tools.preserved, true);
  const run = JSON.parse(fs.readFileSync(receipt.usageRecordPath));
  assert.equal(run.generation.completedSteps, 1);
}));

test('startup and total timeouts retain failed receipts and partial evidence', () => {
  for (const scenario of ['startup', 'partial']) fixture(({ root, launch, receipts }) => {
    const result = launch(scenario, ['--startup-timeout-ms', '500', '--timeout-ms', scenario === 'startup' ? '3000' : '900']);
    assert.notEqual(result.status, 0);
    assert.equal(result.error, undefined, String(result.error));
    const [receipt] = receipts();
    assert.equal(receipt.status, 'failed');
    assert.match(receipt.terminationReason, /timeout/);
    if (scenario === 'partial') {
      assert.equal(receipt.session, 'fixture-session');
      assert.match(fs.readFileSync(receipt.transcript, 'utf8'), /step-1/);
    }
    assert.equal(fs.readFileSync(path.join(root, '.opencode/invocations.local.txt'), 'utf8').trim(), 'run');
  });
});

test('explicit quota cooldown prevents a second child invocation and sanitizes diagnostics', () => fixture(({ root, launch, receipts }) => {
  const first = launch('quota');
  assert.notEqual(first.status, 0);
  const files = fs.readdirSync(path.join(root, 'usage/data/cooldowns'));
  assert.equal(files.length, 1);
  const state = JSON.parse(fs.readFileSync(path.join(root, 'usage/data/cooldowns', files[0])));
  assert.ok(state.retryAt > Date.now() + 90000);
  const catalogFile = path.join(root, 'usage/data/catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogFile));
  catalog.savedAt = '1970-01-01T00:00:00Z';
  fs.writeFileSync(catalogFile, JSON.stringify(catalog));
  const second = launch('success');
  assert.notEqual(second.status, 0);
  assert.match(second.stderr + second.stdout, /cooldown/i);
  assert.equal(fs.readFileSync(path.join(root, '.opencode/invocations.local.txt'), 'utf8').trim(), 'run');
  for (const receipt of receipts()) assert.doesNotMatch(JSON.stringify(receipt), /private-fixture-value/);
}));

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!['--repo', '--agent', '--prompt-file', '--session', '--model', '--browser'].includes(args[index]) || !args[index + 1]) {
    throw new Error('Usage: node scripts/run-opencode.cjs --repo app|api --agent explore|worker --prompt-file <path> [--session <id>] [--model <free model ID>] [--browser true|false]');
  }
  options[args[index].slice(2)] = args[index + 1];
}
if (!['app', 'api'].includes(options.repo) || !['explore', 'worker'].includes(options.agent) || !options['prompt-file']) {
  throw new Error('Repository, agent, and prompt-file are required.');
}
const runtime = JSON.parse(fs.readFileSync(path.join(root, '.opencode/runtime.local.json'), 'utf8'));
const repository = options.repo === 'app' ? root : path.resolve(root, '../DesignerAPI');
const model = options.model || (options.agent === 'explore' ? 'opencode/mimo-v2.6-flash-free' : 'opencode/big-pickle');
if (!runtime.freeModels.includes(model)) {
  throw new Error('Model is outside the verified free-model allowlist. Verify pricing before updating the local runtime configuration.');
}
const task = fs.readFileSync(path.resolve(options['prompt-file']), 'utf8');
const instructions = options.repo === 'app' ? 'Read AGENTS.md first.' : 'Read Agent.md first.';
const prompt = `${instructions} Execute this assigned task directly without spawning other agents. Preserve existing user changes. Stay inside this repository unless the task explicitly authorizes another path. Follow the parent task permissions; stop and report any action requiring additional approval. Return at most 400 words with findings or changed files, validation commands and outcomes, and blockers.\n\n${task}`;
const runDirectory = path.join(root, '.opencode/runs');
fs.mkdirSync(runDirectory, { recursive: true });
const logPath = path.join(runDirectory, `${Date.now()}-${options.repo}-${options.agent}.jsonl`);
const log = fs.createWriteStream(logPath, { flags: 'wx' });
const native = path.extname(runtime.cli).toLowerCase() === '.exe';
const command = [...(native ? [] : [runtime.cli]), 'run', '--format', 'json', '--agent', options.agent, '--model', model];
if (options.session) command.push('--session', options.session);
command.push(prompt);
if (options.browser && !['true', 'false'].includes(options.browser)) throw new Error('Browser must be true or false.');
if (options.browser === 'true' && options.agent !== 'worker') throw new Error('Browser access is limited to workers.');
const environment = { ...process.env };
if (options.browser === 'true') {
  const overrides = JSON.parse(environment.OPENCODE_CONFIG_CONTENT || '{}');
  overrides.agent = { ...overrides.agent, worker: { ...overrides.agent?.worker, tools: { ...overrides.agent?.worker?.tools, 'chrome-devtools*': true } } };
  environment.OPENCODE_CONFIG_CONTENT = JSON.stringify(overrides);
}
const child = spawn(native ? runtime.cli : process.execPath, command, { cwd: repository, env: environment, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
let pending = '';
let failed = false;
let session;
child.stdout.on('data', (chunk) => {
  log.write(chunk);
  pending += chunk.toString();
  const lines = pending.split('\n');
  pending = lines.pop();
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.sessionID && event.sessionID !== session) {
      session = event.sessionID;
      console.log(`Session: ${session}`);
    }
    if (event.type === 'text' && event.part?.text) console.log(event.part.text);
    if (event.type === 'tool_use') console.log(`Tool: ${event.part?.tool || 'unknown'} (${event.part?.state?.status || 'unknown'})`);
    if (event.type === 'error') {
      failed = true;
      console.error(JSON.stringify(event.error || event));
    }
  }
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('error', (error) => {
  failed = true;
  console.error(error.message);
});
child.on('close', (code) => {
  log.end();
  console.log(`Transcript: ${logPath}`);
  process.exitCode = failed ? 1 : (code ?? 1);
});

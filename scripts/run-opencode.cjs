const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const ledger = require('./usage-ledger.cjs');
const controls = require('./opencode-controls.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!['--repo', '--agent', '--prompt-file', '--session', '--model', '--browser', '--chat', '--task', '--kind', '--steps', '--timeout-ms', '--startup-timeout-ms', '--cooldown-ms'].includes(args[index]) || !args[index + 1]) {
    throw new Error('Usage: node scripts/run-opencode.cjs --repo app|api --agent explore|worker --prompt-file <path> [--session <id>] [--model <free model ID>] [--browser true|false] [--chat <Codex chat ID>] [--task <short title>] [--kind <task category>] [--steps 1..200] [--timeout-ms 100..7200000] [--startup-timeout-ms 100..7200000] [--cooldown-ms 100..86400000]');
  }
  options[args[index].slice(2)] = args[index + 1];
}
if (!['app', 'api'].includes(options.repo) || !['explore', 'worker'].includes(options.agent) || !options['prompt-file']) {
  throw new Error('Repository, agent, and prompt-file are required.');
}
const runtimePath = path.join(root, '.opencode/runtime.local.json');
if (!fs.existsSync(runtimePath)) throw new Error('OpenCode runtime is missing. Run scripts/setup-opencode.ps1 first.');
const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8').replace(/^\uFEFF/, ''));
const repository = options.repo === 'app' ? root : path.resolve(root, '../DesignerAPI');
if (!fs.existsSync(repository)) throw new Error(`Repository is missing: ${repository}`);
if (!fs.existsSync(runtime.cli)) throw new Error('Configured OpenCode executable is missing. Run scripts/setup-opencode.ps1 again.');
const maxSteps = controls.resolveSteps(options.agent, options.steps);
const timeoutMs = controls.resolveTimeoutMs(options['timeout-ms']);
const startupTimeoutMs = controls.resolveStartupTimeoutMs(options['startup-timeout-ms']);
const cooldownMs = controls.resolveCooldownMs(options['cooldown-ms']);
const model = options.model || 'opencode/big-pickle';
if (!runtime.freeModels.includes(model)) {
  throw new Error('Model is outside the verified free-model allowlist. Verify pricing before updating the local runtime configuration.');
}
const cooldown = controls.readCooldown({ root, model });
if (cooldown.blocked) {
  controls.recordBlockedAttempt({ root, model });
  console.error(`Model ${model} is on a local cooldown until ${new Date(cooldown.retryAt).toISOString()} (${cooldown.reason || 'quota'}, source: ${cooldown.source || 'unknown'}). No request was sent; this cooldown is local policy, not a server quota reset. Do not retry until then.`);
  process.exit(3);
}
const task = fs.readFileSync(path.resolve(options['prompt-file']), 'utf8');
const chatId = ledger.getChatId(options.chat);
if (chatId && !ledger.sanitizeId(chatId)) throw new Error('Invalid Codex chat ID.');
const catalog = ledger.ensureCatalog({ root, cli: runtime.cli, chatId, model });
if (catalog) console.log(`Catalog: ${catalog.modelCount} models; ${catalog.baseline ? 'initial snapshot' : 'availability changes recorded'}`);
try {
  if (chatId) ledger.syncUsage({ root, chatId });
} catch (error) {
  console.error(`Usage sync warning: ${error.message}`);
}
const instructions = options.repo === 'app' ? 'Read AGENTS.md first.' : 'Read Agent.md first.';
const prompt = `${instructions} Execute this assigned task directly without spawning other agents. Preserve existing user changes. Stay inside this repository unless the task explicitly authorizes another path. Follow the parent task permissions; stop and report any action requiring additional approval. Avoid intermediate narration. Return a final report of at most 400 words with findings or changed files, validation commands and outcomes, and blockers.\n\n${task}`;
const runDirectory = path.join(root, '.opencode/runs');
fs.mkdirSync(runDirectory, { recursive: true });
const startedAt = new Date().toISOString();
const logPath = path.join(runDirectory, `${Date.now()}-${options.repo}-${options.agent}-${crypto.randomBytes(3).toString('hex')}.jsonl`);
const log = fs.createWriteStream(logPath, { flags: 'wx' });
const native = path.extname(runtime.cli).toLowerCase() === '.exe' || !['.js', '.cjs', '.mjs'].includes(path.extname(runtime.cli).toLowerCase());
const command = [...(native ? [] : [runtime.cli]), 'run', '--format', 'json', '--agent', options.agent, '--model', model];
if (options.session) command.push('--session', options.session);
command.push(prompt);
if (options.browser && !['true', 'false'].includes(options.browser)) throw new Error('Browser must be true or false.');
if (options.browser === 'true' && options.agent !== 'worker') throw new Error('Browser access is limited to workers.');
const environment = { ...process.env };
environment.OPENCODE_CONFIG_CONTENT = controls.mergeConfigContent(environment.OPENCODE_CONFIG_CONTENT, { agent: options.agent, steps: maxSteps, browser: options.browser === 'true' });
const stepTracker = controls.createStepTracker();
let failed = false;
let session;
let responseReceived = false;
let completedTools = 0;
let lastResponse = '';
let structuredError = null;
function consumeEvent(line) {
  stepTracker.feed(line);
  let event;
  try { event = JSON.parse(line); } catch { return false; }
  if (event.sessionID && event.sessionID !== session) {
    session = event.sessionID;
    console.log(`Session: ${session}`);
  }
  if (event.type === 'text' && event.part?.text) {
    responseReceived = true;
    lastResponse = event.part.text;
  }
  if (event.type === 'tool_use') console.log(`Tool: ${event.part?.tool || 'unknown'} (${event.part?.state?.status || 'unknown'})`);
  if (event.type === 'tool_use' && event.part?.state?.status === 'completed') completedTools += 1;
  if (event.type === 'error') {
    failed = true;
    const detail = event.error || event;
    console.error(controls.sanitizeStderr(JSON.stringify(detail)));
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    const signals = controls.detectFailureSignals(text);
    if (!structuredError || signals.freeQuota || signals.httpStatus === 429) {
      structuredError = { ...signals, class: controls.classifyFailure({ text, httpStatus: signals.httpStatus, freeQuota: signals.freeQuota }) };
    }
  }
  return event.type != null || event.sessionID != null;
}
controls.runGuardedProcess({
  spawnFn: spawn,
  file: native ? runtime.cli : process.execPath,
  args: command,
  cwd: repository,
  env: environment,
  timeoutMs,
  startupTimeoutMs,
  onLine: consumeEvent,
  onRawStdout: (chunk) => log.write(chunk)
}).then((result) => {
  const stderrTail = controls.sanitizeStderr(result.stderrTail);
  if (stderrTail.trim()) console.error(stderrTail);
  if (result.spawnError) {
    failed = true;
    console.error(result.spawnError.message);
    if (!structuredError) structuredError = { class: 'unknown', httpStatus: null, retryAfterRaw: null, freeQuota: false };
  }
  if (!structuredError && result.exitCode !== 0 && stderrTail.trim()) {
    const signals = controls.detectFailureSignals(stderrTail);
    structuredError = { ...signals, class: controls.classifyFailure({ text: stderrTail, ...signals }) };
  }
  const errorClass = structuredError && structuredError.class !== 'unknown'
    ? structuredError.class
    : (result.terminationReason?.includes('timeout') ? 'timeout' : (structuredError?.class || (result.exitCode !== 0 ? 'unknown' : null)));
  const receiptPath = logPath.replace(/\.jsonl$/, '.receipt.json');
  const completed = !failed && !result.terminationReason && result.exitCode === 0 && Boolean(session) && responseReceived;
  const receipt = {
    status: completed ? 'completed' : 'failed',
    repository,
    agent: options.agent,
    model,
    maxSteps,
    completedSteps: stepTracker.completedSteps,
    budgetReached: stepTracker.completedSteps >= maxSteps,
    stepBudgetNote: 'completedSteps counts unique step_finish events; reaching maxSteps is a budget observation, not a success guarantee.',
    chatId,
    taskTitle: options.task || null,
    taskKind: options.kind || options.agent,
    session: session || null,
    transcript: logPath,
    completedTools,
    responseReceived,
    exitCode: result.exitCode,
    terminationReason: result.terminationReason,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  if (errorClass) {
    const retryAtFromHeader = controls.parseRetryAfter(structuredError?.retryAfterRaw);
    receipt.error = {
      class: errorClass,
      httpStatus: structuredError?.httpStatus ?? null,
      retryAfter: retryAtFromHeader,
      freeQuota: Boolean(structuredError?.freeQuota)
    };
  }
  if (stderrTail.trim()) {
    receipt.stderrTail = stderrTail;
    receipt.stderrRedactionNote = controls.REDACTION_NOTE;
  }
  if (errorClass === 'quota' || errorClass === 'rate') {
    const headerRetryAt = receipt.error?.retryAfter ?? null;
    const retryAt = headerRetryAt != null ? headerRetryAt : Date.now() + cooldownMs;
    const source = headerRetryAt != null ? 'server-retry-after' : 'local-estimated';
    controls.recordCooldown({ root, model, retryAt, reason: errorClass, source });
    receipt.cooldown = { retryAt: new Date(retryAt).toISOString(), reason: errorClass, source };
    console.error(`Recorded local cooldown for ${model} until ${receipt.cooldown.retryAt} (${source}). The launcher never retries automatically and does not infer server quota reset windows.`);
  }
  log.end(() => {
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    let usageFailed = false;
    const returnedReport = lastResponse.slice(0, 4000);
    if (returnedReport) console.log(returnedReport + (lastResponse.length > 4000 ? '\n[Full report retained in transcript.]' : ''));
    try {
      const recorded = ledger.recordOpenCodeRun({ root, receiptPath, transcriptPath: logPath, chatId, taskTitle: receipt.taskTitle, taskKind: receipt.taskKind, prompt, returnedReportChars: returnedReport.length, startedAt, finishedAt: receipt.finishedAt });
      receipt.usageRunId = recorded.id;
      receipt.usageRecordPath = recorded.metadataPath;
      receipt.chatLogPath = recorded.chatPath;
      receipt.usageLogging = 'ok';
      if (chatId) ledger.syncUsage({ root, chatId });
      console.log(`Usage run: ${recorded.id}`);
      if (recorded.chatPath) console.log(`Chat log: ${recorded.chatPath}`);
    } catch (error) {
      usageFailed = true;
      receipt.usageLogging = 'failed';
      console.error(`Usage logging failed: ${error.message}. The transcript and receipt remain available.`);
    }
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`OpenCode: ${receipt.status}${receipt.terminationReason ? ` (${receipt.terminationReason})` : ''}; ${options.agent}; ${model}; steps ${stepTracker.completedSteps}/${maxSteps}; session ${session || 'unavailable'}`);
    console.log(`Transcript: ${logPath}`);
    console.log(`Receipt: ${receiptPath}`);
    process.exitCode = completed && !usageFailed ? 0 : (result.exitCode || 1);
  });
});

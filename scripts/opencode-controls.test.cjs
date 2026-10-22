const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const controls = require('./opencode-controls.cjs');

function tempRoot(prefix = 'opencode-controls-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(directory) {
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(directory, { recursive: true, force: true });
}

function fakeChild({ autoClose = null } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    setImmediate(() => child.emit('close', null));
    return true;
  };
  if (autoClose != null) setImmediate(() => child.emit('close', autoClose));
  return child;
}

test('step counts default per agent and enforce 1..200 bounds', () => {
  assert.equal(controls.resolveSteps('explore'), 12);
  assert.equal(controls.resolveSteps('worker'), 40);
  assert.equal(controls.resolveSteps('worker', '200'), 200);
  assert.equal(controls.resolveSteps('explore', 1), 1);
  assert.throws(() => controls.resolveSteps('worker', 0), /between 1 and 200/);
  assert.throws(() => controls.resolveSteps('worker', 201), /between 1 and 200/);
  assert.throws(() => controls.resolveSteps('worker', '2.5'), /integer/);
  assert.throws(() => controls.resolveSteps('worker', 'abc'), /integer/);
});

test('timeouts and cooldown enforce documented ranges and defaults', () => {
  assert.equal(controls.resolveTimeoutMs(), 1200000);
  assert.equal(controls.resolveStartupTimeoutMs(), 180000);
  assert.equal(controls.resolveCooldownMs(), 60000);
  assert.equal(controls.resolveTimeoutMs('100'), 100);
  assert.equal(controls.resolveTimeoutMs('7200000'), 7200000);
  assert.equal(controls.resolveCooldownMs('86400000'), 86400000);
  assert.throws(() => controls.resolveTimeoutMs(99), /between 100 and 7200000/);
  assert.throws(() => controls.resolveTimeoutMs('7200001'), /between 100 and 7200000/);
  assert.throws(() => controls.resolveStartupTimeoutMs(-1), /between 100 and 7200000/);
  assert.throws(() => controls.resolveCooldownMs(99), /between 100 and 86400000/);
  assert.throws(() => controls.resolveCooldownMs('90000000'), /between 100 and 86400000/);
});

test('mergeConfigContent preserves existing overrides and adds steps plus browser tool', () => {
  const existing = JSON.stringify({ theme: 'dark', agent: { worker: { tools: { read: true } }, explore: { temperature: 0 } } });
  const merged = JSON.parse(controls.mergeConfigContent(existing, { agent: 'worker', steps: 40, browser: true }));
  assert.equal(merged.theme, 'dark');
  assert.equal(merged.agent.explore.temperature, 0);
  assert.equal(merged.agent.worker.tools.read, true);
  assert.equal(merged.agent.worker.tools['chrome-devtools*'], true);
  assert.equal(merged.agent.worker.steps, 40);
  const noBrowser = JSON.parse(controls.mergeConfigContent(existing, { agent: 'explore', steps: 12, browser: false }));
  assert.equal(noBrowser.agent.explore.steps, 12);
  assert.equal(noBrowser.agent.worker.tools['chrome-devtools*'], undefined);
  const empty = JSON.parse(controls.mergeConfigContent(null, { agent: 'worker', steps: 40, browser: false }));
  assert.deepEqual(empty, { agent: { worker: { steps: 40 } } });
  assert.throws(() => controls.mergeConfigContent('{ not json', { agent: 'worker', steps: 1, browser: false }), /not valid JSON/);
  assert.throws(() => controls.mergeConfigContent('[]', { agent: 'worker', steps: 1, browser: false }), /JSON object/);
});

test('sanitizeStderr redacts auth, headers, keys, tokens and keeps a bounded tail', () => {
  const raw = [
    'Authorization: Bearer abc123def456ghi789',
    'x-api-key: sk-live-1234567890abcdefghij',
    'api_key=SUPERSECRETVALUE',
    'password: hunter2',
    'cookie=session=zzz',
    'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.signaturepart',
    'harmless line about reading files'
  ].join('\n');
  const cleaned = controls.sanitizeStderr(raw);
  assert.doesNotMatch(cleaned, /abc123def456ghi789/);
  assert.doesNotMatch(cleaned, /SUPERSECRETVALUE/);
  assert.doesNotMatch(cleaned, /hunter2/);
  assert.doesNotMatch(cleaned, /eyJhbGciOiJIUzI1NiJ9/);
  assert.match(cleaned, /harmless line about reading files/);
  assert.ok(cleaned.length < raw.length);
  const bounded = controls.sanitizeStderr('x'.repeat(50) + 'TAILMARK', 10);
  assert.ok(bounded.length <= 10);
  assert.match(bounded, /TAILMARK$/);
  assert.match(controls.REDACTION_NOTE, /pattern-based/i);
});

test('detectFailureSignals and classifyFailure distinguish quota, rate, permission, timeout, unknown', () => {
  const quota = controls.detectFailureSignals('error: FreeUsageLimitError reached');
  assert.equal(quota.freeQuota, true);
  assert.equal(controls.classifyFailure({ text: 'FreeUsageLimitError', freeQuota: true }), 'quota');
  assert.equal(controls.classifyFailure({ text: 'HTTP 429 Too Many Requests' }), 'rate');
  assert.equal(controls.classifyFailure({ text: '429 rate limit exceeded', httpStatus: 429 }), 'rate');
  assert.equal(controls.classifyFailure({ text: 'status 403 Forbidden' }), 'permission');
  assert.equal(controls.classifyFailure({ text: 'request timed out after 120s' }), 'timeout');
  assert.equal(controls.classifyFailure({ text: 'something unusual happened' }), 'unknown');
  const signals = controls.detectFailureSignals('HTTP 429\nretry-after: 120');
  assert.equal(signals.httpStatus, 429);
  assert.equal(signals.retryAfterRaw, '120');
});

test('parseRetryAfter supports seconds and HTTP dates and rejects garbage', () => {
  const now = 1_700_000_000_000;
  assert.equal(controls.parseRetryAfter('120', now), now + 120000);
  const httpDate = 'Wed, 21 Oct 2026 07:28:00 GMT';
  assert.equal(controls.parseRetryAfter(httpDate, now), Date.parse(httpDate));
  assert.equal(controls.parseRetryAfter('not-a-date', now), null);
  assert.equal(controls.parseRetryAfter(null, now), null);
});

test('structured JSON rate-limit headers retain full dates and status values', () => {
  const date = 'Wed, 21 Oct 2026 07:28:00 GMT';
  const signals = controls.detectFailureSignals(JSON.stringify({ name: 'APIError', data: { statusCode: 429, responseHeaders: { 'Retry-After': date }, responseBody: 'FreeUsageLimitError' } }));
  assert.equal(signals.httpStatus, 429);
  assert.equal(signals.retryAfterRaw, date);
  assert.equal(signals.freeQuota, true);
  assert.equal(controls.parseRetryAfter(signals.retryAfterRaw), Date.parse(date));
  assert.equal(controls.detectFailureSignals(`HTTP 429\nRetry-After: ${date}`).retryAfterRaw, date);
  assert.equal(controls.detectFailureSignals('File path has 429 in its name').httpStatus, null);
  assert.doesNotMatch(controls.sanitizeStderr(JSON.stringify({ api_key: 'fixture-private-credential' })), /fixture-private-credential/);
});

test('a later short cooldown does not shorten an existing server delay', () => {
  const root = tempRoot();
  try {
    controls.recordCooldown({ root, model: 'm', retryAt: 10000, reason: 'quota', source: 'server-retry-after', now: 1 });
    controls.recordCooldown({ root, model: 'm', retryAt: 5000, reason: 'rate', source: 'local-estimated', now: 2 });
    const state = controls.readCooldown({ root, model: 'm', now: 3 });
    assert.equal(state.retryAt, 10000);
    assert.equal(state.source, 'server-retry-after');
  } finally { cleanup(root); }
});

test('cooldown storage is per-model, blocks until retryAt, and records blocked attempts', () => {
  const root = tempRoot();
  try {
    const now = 1_700_000_000_000;
    controls.recordCooldown({ root, model: 'opencode/big-pickle', retryAt: now + 60000, reason: 'quota', source: 'server-retry-after', now });
    controls.recordCooldown({ root, model: 'opencode/other', retryAt: now + 5000, reason: 'rate', source: 'local-estimated', now });
    assert.notEqual(controls.cooldownPath(root, 'opencode/big-pickle'), controls.cooldownPath(root, 'opencode/other'));
    assert.ok(fs.existsSync(controls.cooldownPath(root, 'opencode/big-pickle')));
    assert.ok(fs.existsSync(controls.cooldownPath(root, 'opencode/other')));
    const blocked = controls.readCooldown({ root, model: 'opencode/big-pickle', now });
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.retryAt, now + 60000);
    assert.equal(blocked.source, 'server-retry-after');
    const after = controls.readCooldown({ root, model: 'opencode/big-pickle', now: now + 60001 });
    assert.equal(after.blocked, false);
    const attempts = controls.recordBlockedAttempt({ root, model: 'opencode/big-pickle', now });
    assert.equal(attempts.attempts, 1);
    assert.equal(controls.readCooldown({ root, model: 'opencode/big-pickle', now }).attempts, 1);
    const other = controls.readCooldown({ root, model: 'opencode/other', now });
    assert.equal(other.blocked, true);
    assert.equal(other.reason, 'rate');
    assert.equal(other.attempts, 0);
  } finally {
    cleanup(root);
  }
});

test('step tracker de-duplicates by part id and stable hash', () => {
  const tracker = controls.createStepTracker();
  tracker.feed(JSON.stringify({ type: 'step_finish', part: { id: 's1' } }));
  tracker.feed(JSON.stringify({ type: 'step_finish', part: { id: 's1' } }));
  tracker.feed(JSON.stringify({ type: 'step-finish', part: { id: 's2' } }));
  tracker.feed(JSON.stringify({ type: 'step_finish', part: { tokens: { total: 5 } } }));
  tracker.feed(JSON.stringify({ type: 'step_finish', part: { tokens: { total: 5 } } }));
  assert.equal(tracker.completedSteps, 3);
  tracker.feed('not json');
  assert.equal(tracker.completedSteps, 3);
});

test('runGuardedProcess kills on startup timeout and returns a partial result', async () => {
  const child = fakeChild();
  const result = await controls.runGuardedProcess({
    spawnFn: () => child,
    file: 'node',
    args: [],
    cwd: process.cwd(),
    env: {},
    timeoutMs: 5000,
    startupTimeoutMs: 80,
    onLine: () => true
  });
  assert.equal(result.terminationReason, 'startup-timeout');
  assert.equal(result.startupCleared, false);
  assert.equal(child.killed, true);
});

test('runGuardedProcess keeps a startup-cleared child alive until the total timeout', async () => {
  const child = fakeChild();
  const lines = [];
  const promise = controls.runGuardedProcess({
    spawnFn: () => child,
    file: 'node',
    args: [],
    cwd: process.cwd(),
    env: {},
    timeoutMs: 120,
    startupTimeoutMs: 5000,
    onLine: (line) => { lines.push(line); return true; }
  });
  child.stdout.write(`${JSON.stringify({ type: 'session', sessionID: 'sess-1' })}\n`);
  const result = await promise;
  assert.equal(result.terminationReason, 'timeout');
  assert.equal(result.startupCleared, true);
  assert.equal(child.killed, true);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /sess-1/);
});

test('runGuardedProcess resolves clean exits without a termination reason', async () => {
  const child = fakeChild();
  const promise = controls.runGuardedProcess({
    spawnFn: () => child,
    file: 'node',
    args: [],
    cwd: process.cwd(),
    env: {},
    timeoutMs: 5000,
    startupTimeoutMs: 5000,
    onLine: () => true
  });
  child.stdout.write(`${JSON.stringify({ type: 'text', part: { text: 'done' } })}\n`);
  child.emit('close', 0);
  const result = await promise;
  assert.equal(result.exitCode, 0);
  assert.equal(result.terminationReason, null);
  assert.equal(child.killed, false);
});

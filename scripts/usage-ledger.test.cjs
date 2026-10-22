const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ledger = require('./usage-ledger.cjs');
const { handleHook } = require('./usage-hook.cjs');

function tempRoot(prefix = 'usage-ledger-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(directory) {
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(directory, { recursive: true, force: true });
}

test('usage hook is scoped to the two repositories and never forces continuation', () => {
  const root = path.join(os.tmpdir(), 'usage-hook-fixture', 'Designer');
  const calls = [];
  const collector = { syncUsage: (options) => calls.push(['sync', options]), finishChat: (options) => calls.push(['finish', options]) };
  const options = { root, collector };
  assert.equal(handleHook({ cwd: path.resolve(root, '../Other'), session_id: 'chat-1', hook_event_name: 'Stop' }, options), null);
  assert.equal(calls.length, 0);
  const start = handleHook({ cwd: root, session_id: 'chat-1', hook_event_name: 'SessionStart' }, options);
  assert.equal(start.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(start.hookSpecificOutput.additionalContext, /optimization.json/);
  assert.equal(handleHook({ cwd: path.resolve(root, '../DesignerAPI'), session_id: 'chat-1', hook_event_name: 'Stop' }, options), null);
  assert.deepEqual(calls.map((entry) => entry[0]), ['sync', 'finish']);
  assert.equal(calls[1][1].chatId, 'chat-1');
  assert.throws(() => handleHook({ cwd: root, session_id: '../bad', hook_event_name: 'Stop' }, options), /invalid/);
});

function jsonl(events) {
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}

function codexEvents(entries) {
  return entries.flatMap((entry) => [
    { type: 'turn_context', payload: { model: entry.model } },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: entry.input,
            cached_input_tokens: entry.cached ?? 0,
            output_tokens: entry.output ?? 0,
            reasoning_output_tokens: entry.reasoning ?? 0,
            total_tokens: entry.total ?? entry.input + (entry.output ?? 0)
          }
        }
      }
    }
  ]);
}

function codexContent(entries) {
  return jsonl(codexEvents(entries));
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function withEnv(overrides, run) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return run();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const CATALOG_A = `opencode/free-a
{
  "id": "opencode/free-a",
  "name": "Free {A}",
  "cost": { "input": 0, "output": 0 },
  "limit": { "context": 100000, "output": 4096 },
  "capabilities": { "toolcall": true },
  "status": "active"
}
opencode/free-b
{
  "cost": { "input": 0, "output": 0 },
  "capabilities": { "toolcall": true },
  "status": "active"
}`;

const CATALOG_B = `opencode/free-a
{
  "cost": { "input": 0.5, "output": 0 },
  "capabilities": { "toolcall": true },
  "status": "active"
}
opencode/free-c
{
  "cost": { "input": 0, "output": 0 },
  "capabilities": { "toolcall": true },
  "status": "active"
}`;

const STEP_TRANSCRIPT = jsonl([
  { type: 'step_finish', part: { id: 's1', messageID: 'm1', sessionID: 'sess1', type: 'step-finish', tokens: { total: 100, input: 40, output: 30, reasoning: 10, cache: { read: 15, write: 5 } }, cost: 0 } },
  { type: 'step_finish', part: { id: 's1', messageID: 'm1', sessionID: 'sess1', type: 'step-finish', tokens: { total: 100, input: 40, output: 30, reasoning: 10, cache: { read: 15, write: 5 } }, cost: 0 } },
  { type: 'step_finish', part: { id: 's2', messageID: 'm1', sessionID: 'sess1', type: 'step-finish', tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0 } },
  { type: 'tool_use', part: { id: 't1', tool: 'read', state: { status: 'completed', output: 'evidencetext' } } },
  { type: 'tool_use', part: { id: 't2', tool: 'read', state: { status: 'completed', output: 'evidencetext' } } },
  { type: 'tool_use', part: { id: 't3', tool: 'read', state: { status: 'completed', output: 'data:image/png;base64,AAAA' } } },
  { type: 'tool_use', part: { id: 't4', tool: 'bash', state: { status: 'error' } } },
  { type: 'text', part: { id: 'x1', text: 'report body' } }
]);

const TOTAL_ONLY_TRANSCRIPT = jsonl([
  { type: 'step_finish', part: { id: 'p1', sessionID: 'sess1', type: 'step-finish', tokens: { total: 900 } } },
  { type: 'step_finish', part: { id: 'p2', sessionID: 'sess1', type: 'step-finish', tokens: { total: 100 } } }
]);

const MISSING_COST_TRANSCRIPT = jsonl([
  { type: 'step_finish', part: { id: 'c1', sessionID: 'sess1', tokens: { total: 10, input: 5, output: 5, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0 } },
  { type: 'step_finish', part: { id: 'c2', sessionID: 'sess1', tokens: { total: 10, input: 5, output: 5, reasoning: 0, cache: { read: 0, write: 0 } } } }
]);

function recordRun(root, chatId, extra = {}) {
  const label = `${chatId || 'anon'}${extra.tag ? `-${extra.tag}` : ''}`;
  const receiptPath = writeFile(path.join(root, 'fixtures', `${label}-receipt.json`), JSON.stringify({
    status: extra.status || 'completed',
    agent: 'worker',
    model: 'opencode/big-pickle',
    session: 'sess1',
    repository: root,
    finishedAt: '2026-01-01T10:00:30.000Z'
  }));
  const transcriptPath = writeFile(path.join(root, 'fixtures', `${label}-transcript.jsonl`), extra.transcript || STEP_TRANSCRIPT);
  return ledger.recordOpenCodeRun({
    root,
    receiptPath,
    transcriptPath,
    chatId,
    taskTitle: extra.taskTitle === undefined ? 'Short title' : extra.taskTitle,
    taskKind: extra.taskKind || 'implement',
    prompt: extra.prompt === undefined ? 'hello world' : extra.prompt,
    startedAt: '2026-01-01T10:00:00.000Z',
    finishedAt: '2026-01-01T10:00:30.000Z'
  });
}

test('getChatId resolves explicit, env precedence, and anonymous', () => {
  assert.equal(ledger.getChatId('explicit'), 'explicit');
  withEnv({ CODEX_THREAD_ID: null, CODEX_SESSION_ID: null }, () => {
    assert.equal(ledger.getChatId(), null);
  });
  withEnv({ CODEX_THREAD_ID: 'thread-1', CODEX_SESSION_ID: 'session-1' }, () => {
    assert.equal(ledger.getChatId(), 'thread-1');
  });
  withEnv({ CODEX_THREAD_ID: null, CODEX_SESSION_ID: 'session-1' }, () => {
    assert.equal(ledger.getChatId(), 'session-1');
  });
});

test('sanitizeId rejects traversal and encodes unsafe characters', () => {
  assert.equal(ledger.sanitizeId('../evil'), null);
  assert.equal(ledger.sanitizeId('a/b'), null);
  assert.equal(ledger.sanitizeId('a\\b'), null);
  assert.equal(ledger.sanitizeId('..'), null);
  assert.equal(ledger.sanitizeId(''), null);
  assert.equal(ledger.sanitizeId(42), null);
  assert.equal(ledger.sanitizeId('safe-ID_1.2'), 'safe-ID_1.2');
  assert.equal(ledger.sanitizeId('chat:1'), 'chat_3a_1');
});

test('parseModelCatalog handles headers, nested braces, and braces inside strings', () => {
  const parsed = ledger.parseModelCatalog(CATALOG_A);
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.models[0].id, 'opencode/free-a');
  assert.equal(parsed.models[0].name, 'Free {A}');
  assert.equal(parsed.models[0].cost.input, 0);
  assert.equal(parsed.models[0].limit.context, 100000);
  assert.equal(parsed.models[0].capabilities.toolcall, true);
  assert.equal(parsed.models[1].id, 'opencode/free-b');
});

test('ensureCatalog reports baseline, then diffs free-to-paid, additions, removals', () => {
  const root = tempRoot();
  try {
    const first = ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-1', model: 'opencode/free-a', now: 1000, runner: () => ({ status: 0, stdout: CATALOG_A }) });
    assert.equal(first.baseline, true);
    assert.deepEqual(first.changes.added, []);
    const second = ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-2', now: 2000, runner: () => ({ status: 0, stdout: CATALOG_B }) });
    assert.equal(second.baseline, false);
    assert.deepEqual(second.changes.added, ['opencode/free-c']);
    assert.deepEqual(second.changes.removed, ['opencode/free-b']);
    assert.deepEqual(second.changes.becamePaid, ['opencode/free-a']);
  } finally {
    cleanup(root);
  }
});

test('ensureCatalog skips refresh when fresh for the same chat and asserts paid models', () => {
  const root = tempRoot();
  try {
    ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-1', now: 1000, runner: () => ({ status: 0, stdout: CATALOG_A }) });
    const skipped = ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-1', now: 2000, model: 'opencode/free-a', runner: () => { throw new Error('should not run'); } });
    assert.equal(skipped, null);
    assert.throws(() => ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-2', model: 'opencode/free-a', now: 3000, runner: () => ({ status: 0, stdout: CATALOG_B }) }), /pricing/);
  } finally {
    cleanup(root);
  }
});

test('ensureCatalog persists failed status and throws an actionable error', () => {
  const root = tempRoot();
  try {
    assert.throws(() => ledger.ensureCatalog({ root, cli: 'opencode', chatId: 'chat-1', now: 1000, runner: () => { throw new Error('spawn failed'); } }), /refresh failed/);
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'usage', 'data', 'catalog-meta.json'), 'utf8'));
    assert.equal(meta.lastStatus, 'failed');
    assert.match(meta.lastError, /spawn failed/);
  } finally {
    cleanup(root);
  }
});

test('parseOpenCodeTranscript de-duplicates steps and normalizes totals', () => {
  const parsed = ledger.parseOpenCodeTranscript(STEP_TRANSCRIPT, { charsPerToken: 4 });
  assert.equal(parsed.steps, 2);
  assert.equal(parsed.duplicateSteps, 1);
  assert.equal(parsed.usage.total, 130);
  assert.equal(parsed.usage.input, 50);
  assert.equal(parsed.usage.output, 50);
  assert.equal(parsed.usage.reasoning, 10);
  assert.equal(parsed.usage.cacheRead, 15);
  assert.equal(parsed.usage.cacheWrite, 5);
  assert.equal(parsed.usage.cost, 0);
  assert.equal(parsed.usage.complete, true);
  assert.equal(parsed.toolTotal, 4);
  assert.equal(parsed.toolCompleted, 3);
  assert.equal(parsed.toolFailed, 1);
  assert.equal(parsed.evidenceCount, 1);
  assert.equal(parsed.evidenceChars, 'evidencetext'.length);
});

test('missing OpenCode telemetry stays unknown instead of authoritative zeros', () => {
  const totalOnly = ledger.parseOpenCodeTranscript(TOTAL_ONLY_TRANSCRIPT, { charsPerToken: 4 });
  assert.equal(totalOnly.steps, 2);
  assert.equal(totalOnly.usage.total, 1000);
  assert.equal(totalOnly.usage.input, null);
  assert.equal(totalOnly.usage.output, null);
  assert.equal(totalOnly.usage.cacheRead, null);
  assert.equal(totalOnly.usage.cacheWrite, null);
  assert.equal(totalOnly.usage.cost, null);
  assert.equal(totalOnly.usage.available, true);
  assert.equal(totalOnly.usage.complete, false);

  const missingCost = ledger.parseOpenCodeTranscript(MISSING_COST_TRANSCRIPT, { charsPerToken: 4 });
  assert.equal(missingCost.usage.total, 20);
  assert.equal(missingCost.usage.input, 10);
  assert.equal(missingCost.usage.cost, null);
  assert.equal(missingCost.usage.complete, false);

  const root = tempRoot();
  try {
    const partial = recordRun(root, 'chat-A', { tag: 'partial', transcript: TOTAL_ONLY_TRANSCRIPT });
    assert.equal(partial.run.usage.total, 1000);
    assert.equal(partial.run.usage.input, null);
    assert.equal(partial.run.estimate, null);
    const chat = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-A.md'), 'utf8');
    assert.match(chat, /partial telemetry 1/);
    assert.match(chat, /unreviewed · partial \[details\]/);
  } finally {
    cleanup(root);
  }
});

test('recordOpenCodeRun stores derived features and never the raw prompt', () => {
  const root = tempRoot();
  try {
    const result = recordRun(root, 'chat-A');
    assert.ok(fs.existsSync(result.metadataPath));
    assert.equal(result.run.usage.total, 130);
    assert.equal(result.run.quality, 'unreviewed');
    assert.equal(result.run.features.promptChars, 'hello world'.length);
    assert.equal(result.run.features.evidenceChars, 12);
    assert.equal(result.run.features.workloadTokens, Math.ceil(23 / 4) + 50);
    assert.match(result.run.features.promptHash, /^[a-f0-9]{40}$/);
    assert.equal(Object.prototype.hasOwnProperty.call(result.run, 'prompt'), false);
    assert.ok(fs.existsSync(path.join(root, 'usage', 'chats', 'chat-A.md')));
    assert.ok(fs.existsSync(path.join(root, 'usage', 'optimization.json')));
  } finally {
    cleanup(root);
  }
});

test('recordOpenCodeRun records unattributed runs and rejects unsafe chat ids', () => {
  const root = tempRoot();
  try {
    withEnv({ CODEX_THREAD_ID: null, CODEX_SESSION_ID: null }, () => {
      const result = recordRun(root, null);
      assert.equal(result.run.attributed, false);
      assert.equal(result.run.chatId, null);
      assert.equal(result.chatPath, null);
    });
    assert.throws(() => recordRun(root, '../evil'), /unsafe chat id/i);
  } finally {
    cleanup(root);
  }
});

test('unreviewed runs get no credited estimate but keep a potential range', () => {
  const settings = { ...ledger.DEFAULT_SETTINGS };
  const run = {
    features: { promptChars: 40, evidenceChars: 0, workloadTokens: 1000 },
    reportChars: 40,
    review: null
  };
  const estimate = ledger.computeEstimate(run, settings);
  assert.equal(estimate.creditedNetLow, null);
  assert.equal(estimate.creditedNetHigh, null);
  assert.equal(estimate.potentialNetLow, 500 - (10 + 10 + 500));
});

test('credited NET = gross * credit - overhead for every outcome', () => {
  const settings = { ...ledger.DEFAULT_SETTINGS };
  const build = (outcome) => ledger.computeEstimate({
    features: { promptChars: 0, evidenceChars: 0, workloadTokens: 100 },
    reportChars: 0,
    review: { outcome, gptOverheadTokens: 50 }
  }, settings);

  const accepted = build('accepted');
  assert.equal(accepted.creditedNetLow, 0);
  assert.equal(accepted.creditedNetHigh, 100);

  const reworked = build('reworked');
  assert.equal(reworked.creditedNetLow, -25);
  assert.equal(reworked.creditedNetHigh, 25);

  const rejected = build('rejected');
  assert.equal(rejected.creditedNetLow, -50);
  assert.equal(rejected.creditedNetHigh, -50);
  assert.equal(rejected.netLow, 0);
  assert.equal(rejected.netHigh, 100);

  const unreviewed = build('unreviewed');
  assert.equal(unreviewed.creditedNetLow, null);
  assert.equal(unreviewed.creditedNetHigh, null);
  assert.equal(unreviewed.potentialNetLow, 0);
  assert.equal(unreviewed.potentialNetHigh, 100);

  const na = build('not-applicable');
  assert.equal(na.creditedNetLow, null);
  assert.equal(na.creditedNetHigh, null);
  assert.equal(na.applicable, false);
});

test('rejected net keeps negative overhead and not-applicable is excluded', () => {
  const root = tempRoot();
  try {
    const result = recordRun(root, 'chat-A');
    const rejected = ledger.reviewRun({ root, runId: result.id, outcome: 'rejected', gptOverheadTokens: 1000 });
    assert.equal(rejected.run.estimate.creditedNetLow, -1000);
    assert.equal(rejected.run.estimate.creditedNetHigh, -1000);
    const na = ledger.reviewRun({ root, runId: result.id, outcome: 'not-applicable' });
    assert.equal(na.run.estimate.creditedNetLow, null);
    assert.equal(na.run.estimate.applicable, false);
    assert.equal(na.run.estimate.reviewed, true);
  } finally {
    cleanup(root);
  }
});

test('default overhead scales review allowance by repairs when no explicit override', () => {
  const settings = { ...ledger.DEFAULT_SETTINGS };
  const base = ledger.computeEstimate({ features: { promptChars: 0, evidenceChars: 0, workloadTokens: 100 }, reportChars: 0, review: { outcome: 'accepted' } }, settings);
  assert.equal(base.overheadTokens, 500);
  const repaired = ledger.computeEstimate({ features: { promptChars: 0, evidenceChars: 0, workloadTokens: 100 }, reportChars: 0, review: { outcome: 'accepted', repairs: 2 } }, settings);
  assert.equal(repaired.overheadTokens, 1500);
  assert.equal(repaired.creditedNetLow, 50 - 1500);
});

test('later review without repairs defects or overhead preserves last known values', () => {
  const root = tempRoot();
  try {
    const result = recordRun(root, 'chat-A');
    ledger.reviewRun({ root, runId: result.id, outcome: 'reworked', repairs: 2, defects: 3, gptOverheadTokens: 5000, note: 'first pass' });
    const second = ledger.reviewRun({ root, runId: result.id, outcome: 'accepted', validation: 'checked' });
    assert.equal(second.run.review.repairs, 2);
    assert.equal(second.run.review.defects, 3);
    assert.equal(second.run.review.gptOverheadTokens, 5000);
    assert.equal(second.run.reviews.length, 2);
    assert.equal(second.run.reviews[0].repairs, 2);
    assert.equal(second.run.reviews[0].outcome, 'reworked');
    assert.equal(second.run.reviews[1].outcome, 'accepted');
    const optimization = JSON.parse(fs.readFileSync(path.join(root, 'usage', 'optimization.json'), 'utf8'));
    const obs = optimization.observations['opencode/big-pickle'].implement;
    assert.equal(obs.reworkSignals, 1);
    assert.equal(obs.repairs, 2);
    const chat = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-A.md'), 'utf8');
    assert.match(chat, /Prior signals retained: rework 1/);
    assert.match(optimization.estimator.formula, /gross \* credit - overhead/);
  } finally {
    cleanup(root);
  }
});

test('review history survives rebuilds and repeated rebuilds are byte identical', () => {
  const root = tempRoot();
  try {
    const result = recordRun(root, 'chat-A');
    const accepted = ledger.reviewRun({ root, runId: result.id, outcome: 'accepted', gptOverheadTokens: 100000, validation: 'manual check', repairs: 0, defects: 1 });
    assert.equal(accepted.run.estimate.creditedNetLow < 0, true);
    assert.equal(accepted.run.reviews.length, 1);
    const reworked = ledger.reviewRun({ root, runId: result.id, outcome: 'reworked', gptOverheadTokens: 100000, note: 'one repair' });
    assert.equal(reworked.run.reviews.length, 2);
    assert.equal(reworked.run.quality, 'reworked');
    ledger.rebuild(ledger.layout(root), { now: 1700000000000 });
    const first = fs.readFileSync(path.join(root, 'usage', 'optimization.json'), 'utf8');
    ledger.rebuild(ledger.layout(root), { now: 1700000000000 });
    const second = fs.readFileSync(path.join(root, 'usage', 'optimization.json'), 'utf8');
    assert.equal(first, second);
    const runAfter = JSON.parse(fs.readFileSync(result.metadataPath, 'utf8'));
    assert.equal(runAfter.reviews.length, 2);
  } finally {
    cleanup(root);
  }
});

test('settings edits and extra fields are preserved', () => {
  const root = tempRoot();
  try {
    recordRun(root, 'chat-A');
    const settingsPath = path.join(root, 'usage', 'settings.json');
    const custom = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    custom.charsPerToken = 10;
    custom.futureField = { enabled: true };
    fs.writeFileSync(settingsPath, JSON.stringify(custom, null, 2));
    recordRun(root, 'chat-B');
    const reloaded = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.equal(reloaded.charsPerToken, 10);
    assert.deepEqual(reloaded.futureField, { enabled: true });
  } finally {
    cleanup(root);
  }
});

test('corrupt or out-of-range settings raise actionable errors and never overwrite', () => {
  const root = tempRoot();
  try {
    recordRun(root, 'chat-A');
    const settingsPath = path.join(root, 'usage', 'settings.json');
    const attempt = () => ledger.rebuild(ledger.layout(root), { now: 1000 });

    fs.writeFileSync(settingsPath, '{ not json');
    assert.throws(attempt, /not valid JSON/);
    assert.equal(fs.readFileSync(settingsPath, 'utf8'), '{ not json');

    fs.writeFileSync(settingsPath, JSON.stringify({ ...ledger.DEFAULT_SETTINGS, charsPerToken: -1 }));
    assert.throws(attempt, /finite positive charsPerToken/);
    assert.match(fs.readFileSync(settingsPath, 'utf8'), /-1/);

    fs.writeFileSync(settingsPath, JSON.stringify({ ...ledger.DEFAULT_SETTINGS, reviewAllowanceTokens: -5 }));
    assert.throws(attempt, /non-negative reviewAllowanceTokens/);

    fs.writeFileSync(settingsPath, JSON.stringify({ ...ledger.DEFAULT_SETTINGS, counterfactualLow: 2, counterfactualHigh: 1 }));
    assert.throws(attempt, /counterfactualLow/);

    fs.writeFileSync(settingsPath, JSON.stringify({ ...ledger.DEFAULT_SETTINGS, minReviewedSamples: 0 }));
    assert.throws(attempt, /positive integer minReviewedSamples/);
  } finally {
    cleanup(root);
  }
});

test('per-chat isolation keeps runs separate and markdown concise', () => {
  const root = tempRoot();
  try {
    recordRun(root, 'chat-A');
    recordRun(root, 'chat-B', { taskTitle: 'Other task' });
    const a = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-A.md'), 'utf8');
    const b = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-B.md'), 'utf8');
    assert.match(a, /Chat id: chat-A/);
    assert.doesNotMatch(a, /chat-B/);
    assert.match(b, /Chat id: chat-B/);
    assert.doesNotMatch(b, /chat-A/);
    assert.ok(a.split('\n').length <= 60);
  } finally {
    cleanup(root);
  }
});

test('recent calls cap at five rows', () => {
  const root = tempRoot();
  try {
    for (let index = 0; index < 7; index++) recordRun(root, 'chat-A', { tag: `t${index}` });
    const chat = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-A.md'), 'utf8');
    assert.match(chat, /Recent calls \(5 of 7\)/);
    assert.equal(chat.split('Recent calls')[1].split('\n').filter((line) => line.startsWith('- ')).length, 5);
  } finally {
    cleanup(root);
  }
});

test('parseCodexUsage extracts chat metadata and snapshots across models', () => {
  const content = jsonl([
    { type: 'session_meta', payload: { id: 'codex-1', cwd: 'C:/repo/Designer', timestamp: '2026-01-01T00:00:00Z' } },
    ...codexEvents([{ model: 'gpt-5-codex', input: 100, cached: 40 }, { model: 'gpt-5-mini', input: 30 }])
  ]);
  const parsed = ledger.parseCodexUsage(content);
  assert.equal(parsed.chatId, 'codex-1');
  assert.equal(parsed.cwd, 'C:/repo/Designer');
  assert.equal(parsed.snapshots.length, 2);
  assert.equal(parsed.snapshots[0].model, 'gpt-5-codex');
  assert.equal(parsed.snapshots[1].model, 'gpt-5-mini');
});

test('global cumulative counter allocates deltas across model switches', () => {
  const parsed = ledger.parseCodexUsage(codexContent([
    { model: 'gpt-5-codex', input: 100, cached: 40, reasoning: 20 },
    { model: 'gpt-5-codex', input: 100, cached: 40, reasoning: 20 },
    { model: 'gpt-5-mini', input: 160 },
    { model: 'gpt-5-codex', input: 210 }
  ]));
  const first = ledger.computeCodexDeltas({}, parsed);
  assert.equal(first.state.samples['gpt-5-codex'].input, 150);
  assert.equal(first.state.samples['gpt-5-mini'].input, 60);
  assert.equal(first.state.samples['gpt-5-codex'].cachedInput, 40);
  assert.equal(first.state.samples['gpt-5-codex'].reasoning, 20);
  assert.equal(first.added.total, 210);
  assert.equal(first.added.snapshots, 3);

  const replay = ledger.computeCodexDeltas(first.state, parsed);
  assert.equal(replay.added.total, 210);
  assert.equal(replay.state.samples['gpt-5-codex'].input, 150);
  assert.equal(replay.state.samples['gpt-5-mini'].input, 60);

  const fresh = ledger.computeCodexDeltas({}, parsed);
  assert.equal(fresh.added.total, 210);

  const appended = ledger.parseCodexUsage(codexContent([
    { model: 'gpt-5-codex', input: 100, cached: 40, reasoning: 20 },
    { model: 'gpt-5-codex', input: 100, cached: 40, reasoning: 20 },
    { model: 'gpt-5-mini', input: 160 },
    { model: 'gpt-5-codex', input: 210 },
    { model: 'gpt-5-codex', input: 240 }
  ]));
  const extended = ledger.computeCodexDeltas({}, appended);
  assert.equal(extended.added.total, 240);
  assert.equal(extended.state.samples['gpt-5-codex'].input, 180);
  assert.equal(extended.state.samples['gpt-5-mini'].input, 60);
});

test('global counter reset accumulates the new series with a coverage warning', () => {
  const parsed = ledger.parseCodexUsage(codexContent([
    { model: 'gpt-5-codex', input: 100 },
    { model: 'gpt-5-codex', input: 10 },
    { model: 'gpt-5-codex', input: 40 }
  ]));
  const first = ledger.computeCodexDeltas({}, parsed);
  assert.equal(first.added.total, 140);
  assert.equal(first.state.samples['gpt-5-codex'].input, 140);
  assert.equal(first.state.resetCount, 1);
  assert.ok(first.warnings.some((warning) => warning.includes('reset')));
  const replay = ledger.computeCodexDeltas(first.state, parsed);
  assert.equal(replay.added.total, 140);
  assert.equal(replay.state.samples['gpt-5-codex'].input, 140);
});

test('syncUsage reads project Codex metadata idempotently and preserves review state', () => {
  const base = tempRoot('usage-codex-');
  const root = path.join(base, 'Designer');
  const api = path.join(base, 'DesignerAPI');
  const sessions = path.join(base, 'sessions');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(api, { recursive: true });
  try {
    writeFile(path.join(sessions, 'rollout-1.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'codex-app', cwd: root, timestamp: '2026-01-01T00:00:00Z' } },
      ...codexEvents([
        { model: 'gpt-5-codex', input: 200, cached: 50, output: 80, reasoning: 30, total: 280 },
        { model: 'gpt-5-mini', input: 260, output: 90, total: 350 }
      ])
    ]));
    writeFile(path.join(sessions, 'rollout-2.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'codex-api', cwd: api, timestamp: '2026-01-01T00:00:00Z' } },
      ...codexEvents([{ model: 'gpt-5-codex', input: 10, output: 5, total: 15 }])
    ]));

    const runResult = recordRun(root, 'codex-app');
    ledger.reviewRun({ root, runId: runResult.id, outcome: 'reworked', repairs: 1 });
    writeFile(path.join(root, 'usage', 'data', 'chats', 'codex-app.json'), JSON.stringify({
      chatId: 'codex-app',
      title: 'Custom title',
      reviewedThroughAt: '2026-01-01T10:00:00.000Z'
    }));

    const first = ledger.syncUsage({ root, sessionsDir: sessions, now: 1000 });
    assert.equal(first.ok, true);
    assert.equal(first.synced.length, 2);
    const statePath = path.join(root, 'usage', 'data', 'codex', 'codex-app.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(state.models['gpt-5-codex'].input, 200);
    assert.equal(state.models['gpt-5-codex'].cachedInput, 50);
    assert.equal(state.models['gpt-5-codex'].output, 80);
    assert.equal(state.models['gpt-5-mini'].input, 60);
    assert.equal(state.models['gpt-5-mini'].output, 10);
    assert.equal(state.coverage, 'so-far');

    ledger.syncUsage({ root, sessionsDir: sessions, now: 2000 });
    const again = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(again.models['gpt-5-codex'].input, 200);
    assert.equal(again.models['gpt-5-mini'].input, 60);

    const runAfter = JSON.parse(fs.readFileSync(runResult.metadataPath, 'utf8'));
    assert.equal(runAfter.review.outcome, 'reworked');
    assert.equal(runAfter.review.repairs, 1);
    const chatState = JSON.parse(fs.readFileSync(path.join(root, 'usage', 'data', 'chats', 'codex-app.json'), 'utf8'));
    assert.equal(chatState.title, 'Custom title');
    const chat = fs.readFileSync(path.join(root, 'usage', 'chats', 'codex-app.md'), 'utf8');
    assert.match(chat, /Custom title/);

    const missing = ledger.syncUsage({ root, sessionsDir: path.join(base, 'missing'), now: 3000 });
    assert.equal(missing.ok, true);
    assert.equal(missing.source, 'unknown');
    assert.equal(missing.synced.length, 0);
  } finally {
    cleanup(base);
  }
});

test('human report covers GPT and delegated models, catalog status, and stays concise', () => {
  const root = tempRoot();
  try {
    writeFile(path.join(root, 'usage', 'data', 'catalog-meta.json'), JSON.stringify({
      lastCheckedAt: '2026-01-01T00:00:00.000Z',
      lastStatus: 'ok',
      modelCount: 2
    }));
    recordRun(root, 'chat-A');
    recordRun(root, 'chat-A', { tag: 'partial', transcript: TOTAL_ONLY_TRANSCRIPT });
    ledger.recordExternalRun({ root, chatId: 'chat-A', provider: 'external', model: 'other/model', inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    const sessions = path.join(root, 'sessions');
    writeFile(path.join(sessions, 'roll.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'chat-A', cwd: root, timestamp: '2026-01-01T00:00:00Z' } },
      ...codexEvents([{ model: 'gpt-5-codex', input: 500, cached: 100, output: 200, total: 700 }])
    ]));
    ledger.syncUsage({ root, sessionsDir: sessions });

    const chat = fs.readFileSync(path.join(root, 'usage', 'chats', 'chat-A.md'), 'utf8');
    const summary = fs.readFileSync(path.join(root, 'usage', 'summary.md'), 'utf8');
    assert.match(chat, /\| model \| uncached in \| cached \| out \|/);
    assert.match(chat, /gpt-5-codex/);
    assert.match(chat, /\| model \| assignments \| tokens \| accepted \| reworked \| rejected \| unreviewed \|/);
    assert.match(chat, /opencode\/big-pickle/);
    assert.match(chat, /other\/model/);
    assert.match(chat, /Catalog: ok · 2 models/);
    assert.match(chat, /Recorded-only history/);
    assert.match(chat, /^Delegated: 3 assignments · observed model steps 4/m);
    assert.match(chat, /Quality: accepted 0 .* unreviewed 3/);
    assert.match(summary, /Delegated assignments: 3/);
    assert.doesNotMatch(chat, /Delegated OpenCode/);
    assert.doesNotMatch(summary, /Delegated OpenCode/);
    assert.doesNotMatch(chat, /workload proxy/);
    assert.ok(chat.split('\n').length <= 40, `expected concise report, got ${chat.split('\n').length} lines`);
  } finally {
    cleanup(root);
  }
});

test('recordExternalRun never invents tokens and reviewRun rebuilds reports', () => {
  const root = tempRoot();
  try {
    const result = ledger.recordExternalRun({ root, chatId: 'chat-ext', provider: 'other', model: 'other/model', taskKind: 'manual', taskTitle: 'Manual call' });
    assert.equal(result.run.usage.available, false);
    assert.equal(result.run.usage.total, null);
    assert.equal(result.run.estimate, null);
    const reviewed = ledger.reviewRun({ root, runId: result.id, outcome: 'accepted' });
    assert.equal(reviewed.run.reviews.length, 1);
    const optimization = JSON.parse(fs.readFileSync(path.join(root, 'usage', 'optimization.json'), 'utf8'));
    assert.ok(optimization.observations['other/model'].manual);
    assert.equal(optimization.observations['other/model'].manual.telemetryUnknown, 1);
  } finally {
    cleanup(root);
  }
});

test('catalog checks are per chat and a failed refresh is retried', () => {
  const root = tempRoot();
  try {
    let checks = 0;
    const runner = () => { checks++; return { status: 0, stdout: CATALOG_A }; };
    ledger.ensureCatalog({ root, chatId: 'one', model: 'opencode/free-a', now: 1000, runner });
    ledger.ensureCatalog({ root, chatId: 'two', model: 'opencode/free-a', now: 2000, runner });
    assert.equal(ledger.ensureCatalog({ root, chatId: 'one', model: 'opencode/free-a', now: 3000, runner }), null);
    assert.equal(checks, 2);
    assert.throws(() => ledger.ensureCatalog({ root, chatId: 'three', now: 4000, runner: () => { throw Error('offline'); } }), /refresh failed/);
    ledger.ensureCatalog({ root, chatId: 'three', model: 'opencode/free-a', now: 5000, runner });
    assert.equal(checks, 3);
    assert.equal(fs.readdirSync(path.join(root, 'usage/data/catalog-history')).length, 3);
  } finally { cleanup(root); }
});

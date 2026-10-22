const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ledger = require('./usage-ledger.cjs');

test('generation steps deduplicate repeated events and retain separate UTC dates', () => {
  const first = { type: 'step_finish', timestamp: Date.parse('2026-10-19T23:59:59Z'), part: { id: 'step-a' } };
  const second = { type: 'step_finish', timestamp: Date.parse('2026-10-20T00:00:01Z'), part: { id: 'step-b' } };
  const result = ledger.parseOpenCodeTranscript([first, first, second].map(JSON.stringify).join('\n'));
  assert.equal(result.steps, 2);
  assert.equal(result.duplicateSteps, 1);
  assert.deepEqual(result.stepsByUtcDay, { '2026-10-19': 1, '2026-10-20': 1 });
  assert.equal(result.usage.available, false);
});

test('idless distinct steps with identical tokens are not collapsed', () => {
  const events = [1, 2].map((timestamp) => ({ type: 'step_finish', timestamp, part: { tokens: { total: 10 } } }));
  const result = ledger.parseOpenCodeTranscript([...events, events[0]].map(JSON.stringify).join('\n'));
  assert.equal(result.steps, 2);
  assert.equal(result.usage.total, 20);
});

test('daily efficiency retains failed work, missing telemetry and quality denominators', () => {
  const base = { source: 'opencode', model: 'opencode/big-pickle' };
  const result = ledger.buildRequestEfficiency([
    { ...base, review: { outcome: 'accepted' }, generation: { completedSteps: 4, byUtcDay: { '2026-10-19': 4 } } },
    { ...base, status: 'failed', review: { outcome: 'rejected' }, generation: { completedSteps: 6, byUtcDay: { '2026-10-20': 6 } } },
    { ...base, status: 'failed' },
    { source: 'other', generation: { completedSteps: 99 } }
  ]);
  assert.equal(result.assignments, 3);
  assert.equal(result.completedSteps, 10);
  assert.equal(result.unknownRuns, 1);
  assert.equal(result.byModel[base.model].failed, 2);
  assert.equal(result.byModel[base.model].stepsPerMeasuredAcceptedRun, 4);
  assert.equal(result.byModel[base.model].allObservedStepsPerAcceptedResult, null);
  assert.deepEqual(result.byUtcDay, { '2026-10-19': { [base.model]: 4 }, '2026-10-20': { [base.model]: 6 } });
});

test('backfill is idempotent, preserves attribution/reviews and rejects outside transcripts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'request-efficiency-'));
  try {
    const dirs = ledger.layout(root);
    const transcripts = path.join(root, '.opencode/runs');
    fs.mkdirSync(transcripts, { recursive: true });
    fs.mkdirSync(dirs.runs, { recursive: true });
    const transcriptPath = path.join(transcripts, 'old.jsonl');
    fs.writeFileSync(transcriptPath, JSON.stringify({ type: 'step_finish', timestamp: Date.parse('2026-10-19'), part: { id: 'one' } }));
    const file = path.join(dirs.runs, 'legacy.json');
    const original = { id: 'legacy', source: 'opencode', attributed: false, chatId: null, model: 'free', transcriptPath, review: { outcome: 'rejected', validation: 'Known defect' }, reviews: [{ outcome: 'rejected' }] };
    fs.writeFileSync(file, JSON.stringify(original));
    const outside = path.join(dirs.runs, 'outside.json');
    fs.writeFileSync(outside, JSON.stringify({ ...original, id: 'outside', transcriptPath: path.join(root, 'secret.jsonl') }));
    fs.mkdirSync(path.join(dirs.data, 'cooldowns'), { recursive: true });
    fs.writeFileSync(path.join(dirs.data, 'cooldowns/active.json'), JSON.stringify({ model: 'free', retryAt: Date.parse('2099-01-01'), reason: 'quota', source: 'server-retry-after', attempts: 2 }));
    fs.writeFileSync(path.join(dirs.data, 'cooldowns/expired.json'), JSON.stringify({ model: 'old', retryAt: 1 }));
    ledger.rebuild(dirs);
    const first = fs.readFileSync(file, 'utf8');
    ledger.rebuild(dirs);
    assert.equal(fs.readFileSync(file, 'utf8'), first);
    const updated = JSON.parse(first);
    assert.equal(updated.generation.completedSteps, 1);
    assert.equal(updated.chatId, null);
    assert.equal(updated.attributed, false);
    assert.deepEqual(updated.review, original.review);
    assert.deepEqual(updated.reviews, original.reviews);
    assert.equal(JSON.parse(fs.readFileSync(outside)).generation, undefined);
    const optimization = JSON.parse(fs.readFileSync(dirs.optimization));
    assert.equal(optimization.activeCooldowns.length, 1);
    assert.equal(optimization.activeCooldowns[0].blockedAttempts, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

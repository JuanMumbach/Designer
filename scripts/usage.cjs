#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const ledger = require('./usage-ledger.cjs');

const root = path.resolve(__dirname, '..');

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    return null;
  }
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (typeof token !== 'string' || !token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const equals = token.indexOf('=');
    if (equals !== -1) {
      flags[token.slice(2, equals)] = token.slice(equals + 1);
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (next === undefined || (typeof next === 'string' && next.startsWith('--'))) {
      flags[key] = 'true';
    } else {
      flags[key] = next;
      index++;
    }
  }
  return flags;
}

function intArg(value, label) {
  if (value == null) return null;
  if (!/^\d+$/.test(String(value).trim())) throw new Error(`${label} must be a non-negative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} is out of range`);
  return parsed;
}

function boolArg(value) {
  if (value === true) return true;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('Expected true or false');
}

function requireFlag(flags, name) {
  if (flags[name] == null || flags[name] === '') throw new Error(`--${name} is required`);
  return flags[name];
}

function rejectUnknown(flags, allowed) {
  for (const key of Object.keys(flags)) {
    if (!allowed.includes(key)) throw new Error(`Unknown option: --${key}`);
  }
}

function safeId(value, label) {
  const safe = ledger.sanitizeId(typeof value === 'string' ? value : String(value));
  if (!safe) throw new Error(`Invalid or unsafe ${label}`);
  return safe;
}

function print(value) {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

function commandSync(flags) {
  rejectUnknown(flags, ['all', 'chat']);
  const all = flags.all != null ? boolArg(flags.all) : false;
  const identity = flags.chat || (!all ? ledger.getChatId() : null);
  const chat = identity != null ? safeId(identity, 'chat id') : null;
  if (!all && !chat) throw new Error('Provide --chat <id> or --all true.');
  const result = ledger.syncUsage({ root, chatId: chat, all });
  print({
    ok: result.ok,
    source: result.source,
    sessionsDir: result.sessionsDir,
    synced: result.synced.map((entry) => ({ chatId: entry.chatId, path: entry.statePath })),
    warnings: result.warnings
  });
}

function commandFinish(flags) {
  rejectUnknown(flags, ['chat', 'title', 'note']);
  const chat = safeId(requireFlag(flags, 'chat'), 'chat id');
  const result = ledger.finishChat({ root, chatId: chat, title: flags.title || null, note: flags.note || null });
  print({ chatId: result.chatId, statePath: result.statePath, chatPath: result.chatPath, reviewedThroughAt: result.reviewedThroughAt });
}

function commandReview(flags) {
  rejectUnknown(flags, ['run', 'outcome', 'validation', 'repairs', 'defects', 'gpt-overhead', 'note']);
  const runId = safeId(requireFlag(flags, 'run'), 'run id');
  const outcome = requireFlag(flags, 'outcome');
  if (!ledger.OUTCOMES.includes(outcome)) throw new Error(`Invalid outcome: ${outcome}`);
  const result = ledger.reviewRun({
    root,
    runId,
    outcome,
    validation: flags.validation || null,
    repairs: intArg(flags.repairs, 'repairs'),
    defects: intArg(flags.defects, 'defects'),
    gptOverheadTokens: intArg(flags['gpt-overhead'], 'gpt-overhead'),
    note: flags.note || null
  });
  print({ runId, metadataPath: result.metadataPath, outcome, reviews: result.reviews });
}

function commandCatalog(flags) {
  rejectUnknown(flags, ['chat', 'model']);
  const chat = flags.chat != null ? safeId(flags.chat, 'chat id') : null;
  const runtime = readJsonSafe(path.join(root, '.opencode', 'runtime.local.json')) || {};
  const config = readJsonSafe(path.join(root, 'opencode.json')) || {};
  const model = flags.model || config.model || null;
  const result = ledger.ensureCatalog({ root, cli: runtime.cli, chatId: chat, model });
  if (!result) {
    print({ status: 'fresh', catalogPath: path.join(root, 'usage', 'data', 'catalog.json'), model });
    return;
  }
  print({
    status: 'refreshed',
    catalogPath: result.catalogPath,
    modelCount: result.modelCount,
    baseline: result.baseline,
    changes: result.changes,
    warnings: result.warnings
  });
}

function commandRecord(flags) {
  rejectUnknown(flags, ['chat', 'provider', 'model', 'id', 'total-tokens', 'input-tokens', 'output-tokens', 'title', 'workload-tokens', 'status']);
  const chat = safeId(requireFlag(flags, 'chat'), 'chat id');
  const provider = requireFlag(flags, 'provider');
  const model = requireFlag(flags, 'model');
  if (flags.status && !['completed', 'failed', 'unknown'].includes(flags.status)) throw new Error('Invalid status.');
  const result = ledger.recordExternalRun({
    root,
    chatId: chat,
    provider,
    model,
    id: flags.id || null,
    totalTokens: intArg(flags['total-tokens'], 'total-tokens'),
    inputTokens: intArg(flags['input-tokens'], 'input-tokens'),
    outputTokens: intArg(flags['output-tokens'], 'output-tokens'),
    workloadTokens: intArg(flags['workload-tokens'], 'workload-tokens'),
    status: flags.status || 'unknown',
    taskTitle: flags.title || null,
    taskKind: 'manual'
  });
  print({ id: result.id, metadataPath: result.metadataPath, chatPath: result.chatPath });
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = rest.length ? parseFlags(rest) : {};
  if (command === 'sync') return commandSync(flags);
  if (command === 'finish') return commandFinish(flags);
  if (command === 'review') return commandReview(flags);
  if (command === 'catalog') return commandCatalog(flags);
  if (command === 'record') return commandRecord(flags);
  throw new Error('Usage: node scripts/usage.cjs sync|finish|review|catalog|record [options]');
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SCHEMA_VERSION = 1;
const CATALOG_ARGS = ['models', 'opencode', '--refresh', '--verbose'];
const CATALOG_TIMEOUT_MS = 45000;
const CATALOG_MAX_BUFFER = 8 * 1024 * 1024;
const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_EVIDENCE_CHARS = 20000;
const MAX_RECENT_CALLS = 5;
const DEFAULT_SETTINGS = {
  charsPerToken: 4,
  counterfactualLow: 0.5,
  counterfactualHigh: 1.5,
  reviewAllowanceTokens: 500,
  minReviewedSamples: 3
};
const OUTCOMES = ['accepted', 'reworked', 'rejected', 'unreviewed', 'not-applicable'];
const REVIEW_CREDIT = { accepted: 1, reworked: 0.5, rejected: 0 };

function resolveRoot(root) {
  return path.resolve(root || path.join(__dirname, '..'));
}

function layout(root) {
  const base = resolveRoot(root);
  const usage = path.join(base, 'usage');
  const data = path.join(usage, 'data');
  return {
    root: base,
    usage,
    data,
    runs: path.join(data, 'runs'),
    codex: path.join(data, 'codex'),
    chatState: path.join(data, 'chats'),
    chats: path.join(usage, 'chats'),
    catalog: path.join(data, 'catalog.json'),
    catalogMeta: path.join(data, 'catalog-meta.json'),
    catalogHistory: path.join(data, 'catalog-history'),
    settings: path.join(usage, 'settings.json'),
    optimization: path.join(usage, 'optimization.json'),
    summary: path.join(usage, 'summary.md'),
    gitignore: path.join(usage, '.gitignore')
  };
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

let atomicCounter = 0;

function writeFileAtomic(file, data) {
  const directory = path.dirname(file);
  ensureDir(directory);
  const temp = path.join(directory, `.tmp-${process.pid}-${Date.now()}-${atomicCounter++}-${crypto.randomBytes(4).toString('hex')}`);
  fs.writeFileSync(temp, data);
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function writeJsonAtomic(file, value) {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  if (!file) return null;
  try {
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function listJsonFiles(directory) {
  try {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => path.join(directory, name));
  } catch (error) {
    return [];
  }
}

function ensureUsageLayout(dirs) {
  ensureDir(dirs.runs);
  ensureDir(dirs.codex);
  ensureDir(dirs.chats);
  ensureDir(dirs.chatState);
  if (!fs.existsSync(dirs.gitignore)) writeFileAtomic(dirs.gitignore, '*\n');
}

function validateSettings(candidate) {
  const value = { ...candidate };
  if (!(Number.isFinite(value.charsPerToken) && value.charsPerToken > 0)) {
    throw new Error('usage/settings.json must define a finite positive charsPerToken; correct the file manually (preferences are never overwritten)');
  }
  if (!(Number.isFinite(value.reviewAllowanceTokens) && value.reviewAllowanceTokens >= 0)) {
    throw new Error('usage/settings.json must define a finite non-negative reviewAllowanceTokens; correct the file manually (preferences are never overwritten)');
  }
  if (!(Number.isFinite(value.counterfactualLow) && Number.isFinite(value.counterfactualHigh) && value.counterfactualLow >= 0 && value.counterfactualLow <= value.counterfactualHigh)) {
    throw new Error('usage/settings.json must define 0 <= counterfactualLow <= counterfactualHigh; correct the file manually (preferences are never overwritten)');
  }
  if (!(Number.isInteger(value.minReviewedSamples) && value.minReviewedSamples > 0)) {
    throw new Error('usage/settings.json must define a positive integer minReviewedSamples; correct the file manually (preferences are never overwritten)');
  }
  return value;
}

function loadSettings(dirs) {
  if (!fs.existsSync(dirs.settings)) {
    const seeded = { ...DEFAULT_SETTINGS };
    writeJsonAtomic(dirs.settings, validateSettings(seeded));
    return seeded;
  }
  const raw = fs.readFileSync(dirs.settings, 'utf8').replace(/^\uFEFF/, '');
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch (error) {
    throw new Error(`usage/settings.json is not valid JSON (${error.message}); repair it manually (preferences are never overwritten)`);
  }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new Error('usage/settings.json must contain a JSON object; repair it manually (preferences are never overwritten)');
  }
  const merged = { ...stored };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (merged[key] == null) merged[key] = DEFAULT_SETTINGS[key];
  }
  return validateSettings(merged);
}

function sanitizeId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (trimmed === '.' || trimmed === '..') return null;
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0') || trimmed.includes('..')) return null;
  return trimmed.replace(/[^A-Za-z0-9._-]/g, (ch) => `_${ch.codePointAt(0).toString(16)}_`);
}

function requireSafeId(value, label) {
  const safe = sanitizeId(value);
  if (!safe) throw new Error(`Invalid or unsafe ${label}`);
  return safe;
}

function getChatId(explicit) {
  const value = explicit != null ? explicit : (process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID);
  return value == null || value === '' ? null : value;
}

function nowIso(now) {
  const time = now == null ? Date.now() : (typeof now === 'number' ? now : Date.parse(now));
  const date = new Date(Number.isFinite(time) ? time : Date.now());
  return date.toISOString();
}

function toEpoch(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortText(value, max = 80) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}\u2026` : cleaned;
}

function shortLabel(value, max = 40) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned || cleaned.length > max) return null;
  return /^[a-z0-9._-]+$/.test(cleaned) ? cleaned : null;
}

function tokenNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function normalizeUsage(value) {
  return {
    input: tokenNumber(value?.input) ?? 0,
    cachedInput: tokenNumber(value?.cachedInput) ?? 0,
    output: tokenNumber(value?.output) ?? 0,
    reasoning: tokenNumber(value?.reasoning) ?? 0,
    total: tokenNumber(value?.total) ?? 0
  };
}

function sameUsage(a, b) {
  const left = normalizeUsage(a);
  const right = normalizeUsage(b);
  return left.input === right.input && left.cachedInput === right.cachedInput && left.output === right.output && left.reasoning === right.reasoning && left.total === right.total;
}

function isReset(current, previous) {
  const left = normalizeUsage(current);
  const right = normalizeUsage(previous);
  if (left.total || right.total) return left.total < right.total;
  return left.input < right.input;
}

function subtractUsage(current, previous) {
  const left = normalizeUsage(current);
  const right = normalizeUsage(previous);
  const delta = {
    input: Math.max(0, left.input - right.input),
    cachedInput: Math.max(0, left.cachedInput - right.cachedInput),
    output: Math.max(0, left.output - right.output),
    reasoning: Math.max(0, left.reasoning - right.reasoning)
  };
  delta.total = left.total || right.total ? Math.max(0, left.total - right.total) : delta.input + delta.output;
  return delta;
}

function stableHash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function noCommaNumber(value) {
  return typeof value === 'number' ? String(value) : String(value);
}

function parseJsonLines(text) {
  const events = [];
  if (typeof text !== 'string') return events;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      continue;
    }
  }
  return events;
}

function normalizeCatalogModel(id, raw) {
  const costInput = tokenNumber(raw?.cost?.input);
  const costOutput = tokenNumber(raw?.cost?.output);
  const contextLimit = tokenNumber(raw?.limit?.context);
  const outputLimit = tokenNumber(raw?.limit?.output);
  const toolcall = Boolean(firstDefined(raw?.capabilities?.toolcall, raw?.capabilities?.tools, raw?.toolcall));
  return {
    id,
    name: typeof raw?.name === 'string' && raw.name ? raw.name : id,
    status: typeof raw?.status === 'string' && raw.status ? raw.status : 'unknown',
    cost: { input: costInput, output: costOutput },
    limit: { context: contextLimit, output: outputLimit },
    capabilities: { toolcall }
  };
}

function extractJsonBlock(lines, start) {
  let index = start;
  while (index < lines.length && lines[index].trim() === '') index++;
  if (index >= lines.length) return { json: null, next: start };
  let buffer = '';
  let depth = 0;
  let started = false;
  let inString = false;
  let escaped = false;
  for (; index < lines.length; index++) {
    const line = lines[index];
    buffer += (buffer ? '\n' : '') + line;
    for (let cursor = 0; cursor < line.length; cursor++) {
      const char = line[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') {
        depth++;
        started = true;
        continue;
      }
      if (char === '}') {
        depth--;
        if (started && depth === 0) {
          const slice = buffer.slice(buffer.indexOf('{'));
          try {
            return { json: JSON.parse(slice), next: index + 1 };
          } catch (error) {
            return { json: null, next: start };
          }
        }
      }
    }
  }
  return { json: null, next: start };
}

function parseModelCatalog(text) {
  const warnings = [];
  const models = [];
  if (typeof text !== 'string' || !text.trim()) return { models, warnings: ['empty-catalog-output'] };
  const lines = text.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index++;
      continue;
    }
    const header = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(trimmed);
    if (header) {
      const block = extractJsonBlock(lines, index + 1);
      if (block.json && typeof block.json === 'object') {
        models.push(normalizeCatalogModel(trimmed, block.json));
        index = block.next;
        continue;
      }
      warnings.push(`no-json-body:${trimmed}`);
    }
    index++;
  }
  if (!models.length) {
    const cleaned = text.trim();
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      try {
        const parsed = JSON.parse(cleaned);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.models) ? parsed.models : Object.values(parsed.models || {}));
        for (const raw of list) {
          if (raw && typeof raw === 'object' && typeof raw.id === 'string') models.push(normalizeCatalogModel(raw.id, raw));
        }
      } catch (error) {
        warnings.push('unparsable-json-catalog');
      }
    }
  }
  return { models, warnings };
}

function catalogToMap(models) {
  const map = {};
  for (const model of models) map[model.id] = model;
  return map;
}

function diffCatalog(previous, next) {
  const empty = { baseline: false, added: [], removed: [], becamePaid: [], becameFree: [], limitChanges: [], capabilityChanges: [], statusChanges: [] };
  if (!previous || !previous.models) return { ...empty, baseline: true };
  const before = previous.models || {};
  const after = next.models || {};
  const changes = { ...empty };
  for (const id of Object.keys(after)) {
    if (!before[id]) {
      changes.added.push(id);
      continue;
    }
    const oldModel = before[id];
    const newModel = after[id];
    const wasFree = oldModel.cost?.input === 0 && oldModel.cost?.output === 0;
    const isFree = newModel.cost?.input === 0 && newModel.cost?.output === 0;
    if (wasFree && !isFree) changes.becamePaid.push(id);
    if (!wasFree && isFree) changes.becameFree.push(id);
    if (oldModel.limit?.context !== newModel.limit?.context || oldModel.limit?.output !== newModel.limit?.output) {
      changes.limitChanges.push({ id, from: oldModel.limit, to: newModel.limit });
    }
    if (Boolean(oldModel.capabilities?.toolcall) !== Boolean(newModel.capabilities?.toolcall)) {
      changes.capabilityChanges.push({ id, toolcall: Boolean(newModel.capabilities?.toolcall) });
    }
    if (oldModel.status !== newModel.status) {
      changes.statusChanges.push({ id, from: oldModel.status, to: newModel.status });
    }
  }
  for (const id of Object.keys(before)) {
    if (!after[id]) changes.removed.push(id);
  }
  changes.baseline = false;
  return changes;
}

function assertModelUsable(snapshot, modelId) {
  const model = snapshot?.models?.[modelId];
  if (!model) throw new Error(`Model ${modelId} was not found in the refreshed catalog`);
  if (model.status !== 'active') throw new Error(`Model ${modelId} is not active (status: ${model.status}); no paid or inactive model will be routed`);
  if (!model.capabilities?.toolcall) throw new Error(`Model ${modelId} does not advertise tool calling; no routing change applied`);
  if (model.cost?.input !== 0 || model.cost?.output !== 0) {
    throw new Error(`Model ${modelId} does not have known zero input/output pricing; never routing paid models automatically`);
  }
  return model;
}

function invokeCatalogCli(cli, runner) {
  if (typeof runner === 'function') {
    const out = runner({ cli, args: CATALOG_ARGS, timeout: CATALOG_TIMEOUT_MS, maxBuffer: CATALOG_MAX_BUFFER }) || {};
    return { status: typeof out.status === 'number' ? out.status : 0, stdout: typeof out.stdout === 'string' ? out.stdout : '' };
  }
  if (!cli) throw new Error('OpenCode CLI path is required for a catalog refresh');
  const result = spawnSync(cli, CATALOG_ARGS, { encoding: 'utf8', timeout: CATALOG_TIMEOUT_MS, maxBuffer: CATALOG_MAX_BUFFER, windowsHide: true });
  return { status: result.status == null ? 1 : result.status, stdout: result.stdout || '' };
}

function ensureCatalog(options = {}) {
  const dirs = layout(options.root);
  ensureUsageLayout(dirs);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const clock = Number.isFinite(now) ? now : Date.now();
  const meta = readJson(dirs.catalogMeta) || {};
  const snapshot = readJson(dirs.catalog);
  const chatId = options.chatId == null ? null : sanitizeId(options.chatId);
  if (options.chatId != null && !chatId) throw new Error('Invalid or unsafe chat id');
  const savedAt = snapshot?.savedAt ? Date.parse(snapshot.savedAt) : null;
  const age = savedAt ? clock - savedAt : Infinity;
  const stale = !snapshot || !Number.isFinite(age) || age < 0 || age > CATALOG_MAX_AGE_MS || meta.lastStatus === 'failed';
  const checkedAt = meta.chatChecks?.[chatId] || (meta.lastStatus === 'ok' && meta.lastChatId === chatId ? meta.lastCheckedAt : null);
  const newChat = Boolean(chatId) && (!checkedAt || clock - Date.parse(checkedAt) > CATALOG_MAX_AGE_MS);
  if (!stale && !newChat) {
    if (snapshot && options.model) assertModelUsable(snapshot, options.model);
    return null;
  }
  let result;
  try {
    result = invokeCatalogCli(options.cli, options.runner);
  } catch (error) {
    writeJsonAtomic(dirs.catalogMeta, { ...meta, lastCheckedAt: nowIso(clock), lastChatId: chatId, lastStatus: 'failed', lastError: shortText(error.message, 200) });
    throw new Error(`OpenCode catalog refresh failed: ${error.message}. Verify the CLI path and retry; no model changes were applied.`);
  }
  if (result.status !== 0) {
    writeJsonAtomic(dirs.catalogMeta, { ...meta, lastCheckedAt: nowIso(clock), lastChatId: chatId, lastStatus: 'failed', lastError: `exit ${result.status}` });
    throw new Error(`OpenCode catalog refresh exited with code ${result.status}. Verify the CLI and retry; no model changes were applied.`);
  }
  const parsed = parseModelCatalog(result.stdout);
  if (!parsed.models.length) {
    writeJsonAtomic(dirs.catalogMeta, { ...meta, lastCheckedAt: nowIso(clock), lastChatId: chatId, lastStatus: 'failed', lastError: 'no-models' });
    throw new Error('OpenCode catalog refresh returned no parsable models; no model changes were applied.');
  }
  const nextSnapshot = { savedAt: nowIso(clock), models: catalogToMap(parsed.models) };
  const changes = diffCatalog(snapshot, nextSnapshot);
  writeJsonAtomic(path.join(dirs.catalogHistory, `${clock}-${stableHash(JSON.stringify(nextSnapshot.models)).slice(0, 10)}.json`), { ...nextSnapshot, changes });
  writeJsonAtomic(dirs.catalog, nextSnapshot);
  writeJsonAtomic(dirs.catalogMeta, {
    lastCheckedAt: nowIso(clock),
    lastChatId: chatId,
    chatChecks: { ...meta.chatChecks, ...(chatId ? { [chatId]: nowIso(clock) } : {}) },
    lastStatus: 'ok',
    modelCount: parsed.models.length,
    lastChanges: changes
  });
  rebuild(dirs, { now: clock });
  if (options.model) assertModelUsable(nextSnapshot, options.model);
  return {
    root: dirs.root,
    chatId,
    refreshedAt: nowIso(clock),
    baseline: changes.baseline,
    changes,
    catalogPath: dirs.catalog,
    modelCount: parsed.models.length,
    warnings: parsed.warnings
  };
}

function parseOpenCodeTranscript(text, options = {}) {
  const events = parseJsonLines(text);
  const seenSteps = new Set();
  const seenTools = new Set();
  const seenText = new Set();
  const evidenceHashes = new Set();
  const result = {
    sessionId: null,
    model: null,
    steps: 0,
    stepsByUtcDay: {},
    duplicateSteps: 0,
    toolTotal: 0,
    toolCompleted: 0,
    toolFailed: 0,
    reportChars: 0,
    evidenceChars: 0,
    evidenceCount: 0,
    evidenceHashes: [],
    usage: { total: null, input: null, output: null, reasoning: null, cacheRead: null, cacheWrite: null, cost: null, complete: false, available: false }
  };
  const totals = { total: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  const counts = { total: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  for (const event of events) {
    const part = event?.part || {};
    const type = event?.type;
    if (part.sessionID && !result.sessionId) result.sessionId = part.sessionID;
    if (type === 'step_finish' || type === 'step-finish') {
      const id = part.id || stableHash(JSON.stringify(event));
      if (seenSteps.has(id)) {
        result.duplicateSteps++;
        continue;
      }
      seenSteps.add(id);
      const stepTime = typeof event.timestamp === 'number' ? event.timestamp : Date.parse(event.timestamp);
      const day = Number.isFinite(stepTime) ? new Date(stepTime).toISOString().slice(0, 10) : 'unknown';
      result.stepsByUtcDay[day] = (result.stepsByUtcDay[day] || 0) + 1;
      const tokens = part.tokens || {};
      const components = {
        input: tokenNumber(tokens.input),
        output: tokenNumber(tokens.output),
        reasoning: tokenNumber(tokens.reasoning),
        cacheRead: tokenNumber(tokens.cache?.read),
        cacheWrite: tokenNumber(tokens.cache?.write)
      };
      const explicitTotal = tokenNumber(tokens.total);
      const present = Object.values(components).filter((value) => value != null);
      let stepTotal = explicitTotal;
      if (stepTotal == null && present.length === 5) stepTotal = present.reduce((sum, value) => sum + value, 0);
      if (stepTotal != null) {
        totals.total += stepTotal;
        counts.total += 1;
      }
      for (const key of Object.keys(components)) {
        if (components[key] != null) {
          totals[key] += components[key];
          counts[key] += 1;
        }
      }
      const stepCost = tokenNumber(part.cost);
      if (stepCost != null) {
        totals.cost += stepCost;
        counts.cost += 1;
      }
      result.steps++;
    }
    if (type === 'tool_use') {
      const id = part.id || stableHash(`${part.tool || ''}:${JSON.stringify(part.state || {})}`);
      if (seenTools.has(id)) continue;
      seenTools.add(id);
      result.toolTotal++;
      const status = part.state?.status;
      if (status === 'completed') result.toolCompleted++;
      else if (status === 'error' || status === 'failed') result.toolFailed++;
      const output = firstDefined(part.state?.output, part.state?.result, part.output);
      if (status === 'completed' && typeof output === 'string' && output) {
        if (/^data:/i.test(output) || /^[A-Za-z0-9+/]{200,}={0,2}$/.test(output)) continue;
        const tool = String(part.tool || '');
        if (/image|screenshot/i.test(tool)) continue;
        const hash = stableHash(output);
        if (evidenceHashes.has(hash)) continue;
        evidenceHashes.add(hash);
        const counted = Math.min(output.length, MAX_EVIDENCE_CHARS);
        result.evidenceChars += counted;
        result.evidenceCount++;
        if (result.evidenceHashes.length < 100) result.evidenceHashes.push(hash.slice(0, 12));
      }
    }
    if (type === 'text' && part.text) {
      const id = part.id || stableHash(`text:${part.messageID || ''}:${part.text.length}`);
      if (seenText.has(id)) continue;
      seenText.add(id);
      result.reportChars += part.text.length;
    }
  }
  const steps = result.steps;
  const known = (key) => steps > 0 && counts[key] === steps;
  const fieldOrder = ['total', 'input', 'output', 'reasoning', 'cacheRead', 'cacheWrite', 'cost'];
  result.usage.total = known('total') ? totals.total : null;
  result.usage.input = known('input') ? totals.input : null;
  result.usage.output = known('output') ? totals.output : null;
  result.usage.reasoning = known('reasoning') ? totals.reasoning : null;
  result.usage.cacheRead = known('cacheRead') ? totals.cacheRead : null;
  result.usage.cacheWrite = known('cacheWrite') ? totals.cacheWrite : null;
  result.usage.cost = known('cost') ? totals.cost : null;
  result.usage.available = result.usage.total != null;
  result.usage.complete = steps > 0 && fieldOrder.every((key) => known(key));
  return result;
}

function openCodeRunId(parts) {
  const signature = ['opencode',
    parts.receiptPath ? path.resolve(parts.receiptPath).toLowerCase() : '',
    parts.transcriptPath ? path.resolve(parts.transcriptPath).toLowerCase() : '',
    parts.session || '',
    parts.model || '',
    parts.finishedAt || ''].join('|');
  return `oc-${stableHash(signature).slice(0, 16)}`;
}

function defaultTitle(receipt, taskTitle) {
  if (taskTitle) return shortText(taskTitle, 80);
  const repository = receipt?.repository ? path.basename(path.resolve(receipt.repository)) : null;
  const agent = receipt?.agent || null;
  if (repository && agent) return `${repository}/${agent}`;
  if (agent) return agent;
  return 'opencode';
}

function recordOpenCodeRun(options = {}) {
  const dirs = layout(options.root);
  const rawChatId = getChatId(options.chatId);
  let chatId = null;
  if (rawChatId != null) chatId = requireSafeId(rawChatId, 'chat id');
  ensureUsageLayout(dirs);
  const settings = loadSettings(dirs);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const receipt = readJson(options.receiptPath) || {};
  let transcriptText = '';
  if (options.transcriptPath && fs.existsSync(path.resolve(options.transcriptPath))) {
    transcriptText = fs.readFileSync(path.resolve(options.transcriptPath), 'utf8');
  }
  const parsed = parseOpenCodeTranscript(transcriptText, settings);
  const runId = openCodeRunId({
    receiptPath: options.receiptPath,
    transcriptPath: options.transcriptPath,
    session: receipt.session || parsed.sessionId,
    model: receipt.model || parsed.model,
    finishedAt: options.finishedAt || receipt.finishedAt
  });
  const promptChars = typeof options.prompt === 'string' ? options.prompt.length : null;
  const visibleOutput = parsed.usage.available ? parsed.usage.output : null;
  const charTokens = (promptChars != null || parsed.evidenceChars)
    ? Math.ceil(((promptChars || 0) + parsed.evidenceChars) / settings.charsPerToken)
    : null;
  const features = {
    promptChars,
    promptHash: promptChars != null ? stableHash(options.prompt) : null,
    evidenceChars: parsed.evidenceCount ? parsed.evidenceChars : null,
    evidenceCount: parsed.evidenceCount || 0,
    evidenceHashes: parsed.evidenceHashes,
    visibleOutputTokens: visibleOutput
  };
  features.workloadTokens = charTokens != null && visibleOutput != null ? charTokens + visibleOutput : null;
  const startedEpoch = toEpoch(options.startedAt);
  const finishedEpoch = toEpoch(options.finishedAt || receipt.finishedAt);
  const metadataPath = path.join(dirs.runs, `${runId}.json`);
  const previous = readJson(metadataPath);
  const run = {
    id: runId,
    schemaVersion: SCHEMA_VERSION,
    source: 'opencode',
    chatId,
    attributed: Boolean(chatId),
    provider: 'opencode',
    agent: receipt.agent || null,
    model: receipt.model || parsed.model || 'unknown',
    session: receipt.session || parsed.sessionId || null,
    status: receipt.status || (parsed.steps ? 'completed' : 'unknown'),
    quality: previous?.quality && previous.quality !== 'unreviewed' ? previous.quality : 'unreviewed',
    title: defaultTitle(receipt, options.taskTitle),
    taskTitle: options.taskTitle ? shortText(options.taskTitle, 80) : null,
    taskKind: shortLabel(options.taskKind) || 'unknown',
    startedAt: startedEpoch != null ? nowIso(startedEpoch) : null,
    finishedAt: finishedEpoch != null ? nowIso(finishedEpoch) : null,
    recordedAt: nowIso(now),
    durationMs: startedEpoch != null && finishedEpoch != null ? Math.max(0, finishedEpoch - startedEpoch) : null,
    receiptPath: options.receiptPath ? path.resolve(options.receiptPath) : null,
    transcriptPath: options.transcriptPath ? path.resolve(options.transcriptPath) : null,
    usage: { ...parsed.usage },
    generation: { completedSteps: parsed.steps, byUtcDay: parsed.stepsByUtcDay, coverage: parsed.steps ? 'observed-lower-bound' : 'no-completed-steps-observed' },
    tools: {
      total: parsed.toolTotal || 0,
      completed: parsed.toolCompleted || 0,
      failed: parsed.toolFailed || 0,
      unknown: Math.max(0, (parsed.toolTotal || 0) - (parsed.toolCompleted || 0) - (parsed.toolFailed || 0))
    },
    features,
    reportChars: options.returnedReportChars != null ? tokenNumber(options.returnedReportChars) : (parsed.reportChars || null),
    reportTokens: options.returnedReportChars != null ? Math.ceil(options.returnedReportChars / settings.charsPerToken) : (parsed.reportChars ? Math.ceil(parsed.reportChars / settings.charsPerToken) : null),
    review: previous?.review || null,
    reviews: Array.isArray(previous?.reviews) ? previous.reviews : [],
    estimate: previous?.estimate || null
  };
  writeJsonAtomic(metadataPath, run);
  rebuild(dirs, { now });
  return { id: runId, metadataPath, run, chatPath: chatId ? path.join(dirs.chats, `${chatId}.md`) : null };
}

function readPath(object, keys) {
  let current = object;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return null;
    current = current[key];
  }
  return current == null ? null : current;
}

function extractTokenUsage(total) {
  if (!total || typeof total !== 'object') return null;
  const snapshot = {
    input: tokenNumber(firstDefined(total.input_tokens, total.input)),
    cachedInput: tokenNumber(firstDefined(total.cached_input_tokens, total.cachedInput)),
    output: tokenNumber(firstDefined(total.output_tokens, total.output)),
    reasoning: tokenNumber(firstDefined(total.reasoning_output_tokens, total.reasoning)),
    total: tokenNumber(firstDefined(total.total_tokens, total.total))
  };
  if (Object.values(snapshot).every((value) => value == null)) return null;
  return snapshot;
}

function parseCodexUsage(content) {
  const entries = Array.isArray(content) ? content : String(content == null ? '' : content).split(/\r?\n/);
  const result = { chatId: null, cwd: null, createdAt: null, latestUsageTimestamp: null, snapshots: [], warnings: [] };
  let currentModel = null;
  const handle = (event) => {
    if (!event || typeof event !== 'object') return;
    const type = event.type;
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : event;
    if (type === 'session_meta' || event.session_meta) {
      const meta = event.session_meta || payload;
      if (!result.chatId) result.chatId = firstDefined(readPath(meta, ['id']), readPath(event, ['id']));
      if (!result.cwd) result.cwd = firstDefined(readPath(meta, ['cwd']), readPath(event, ['cwd']));
      if (!result.createdAt) result.createdAt = firstDefined(readPath(meta, ['timestamp']), event.timestamp);
      return;
    }
    if (type === 'turn_context') {
      const model = firstDefined(readPath(payload, ['model']), readPath(payload, ['model_name']));
      if (typeof model === 'string' && model) currentModel = model;
      return;
    }
    const payloadType = readPath(payload, ['type']);
    if (type === 'event_msg' && payloadType === 'token_count') {
      const info = payload.info || payload;
      const total = firstDefined(info.total_token_usage, info.total);
      const snapshot = extractTokenUsage(total);
      if (!snapshot) return;
      const stamp = event.timestamp || null;
      if (stamp && (!result.latestUsageTimestamp || String(stamp) > String(result.latestUsageTimestamp))) {
        result.latestUsageTimestamp = String(stamp);
      }
      result.snapshots.push({ model: currentModel || 'unknown', timestamp: stamp, cumulative: normalizeUsage(snapshot) });
    }
  };
  for (const entry of entries) {
    if (entry && typeof entry === 'object') {
      handle(entry);
    } else {
      const line = String(entry).trim();
      if (!line) continue;
      try {
        handle(JSON.parse(line));
      } catch (error) {
        continue;
      }
    }
  }
  if (!result.chatId) result.warnings.push('missing-chat-id');
  return result;
}

function computeCodexDeltas(previousState, parsed) {
  const snapshots = parsed.snapshots || [];
  const samples = {};
  const warnings = [];
  let previousGlobal = null;
  let resetCount = 0;
  let latestUsageTimestamp = null;
  let usageCount = 0;
  const computed = { snapshots: 0, input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 };
  for (const snapshot of snapshots) {
    if (!snapshot || !snapshot.cumulative) continue;
    if (snapshot.timestamp && (!latestUsageTimestamp || String(snapshot.timestamp) > String(latestUsageTimestamp))) {
      latestUsageTimestamp = String(snapshot.timestamp);
    }
    const model = snapshot.model || 'unknown';
    const current = normalizeUsage(snapshot.cumulative);
    if (previousGlobal && sameUsage(previousGlobal, current)) continue;
    let delta;
    let wasReset = false;
    if (previousGlobal && isReset(current, previousGlobal)) {
      wasReset = true;
      resetCount += 1;
      delta = current;
    } else if (previousGlobal) {
      delta = subtractUsage(current, previousGlobal);
    } else {
      delta = current;
    }
    previousGlobal = current;
    const entry = samples[model] || { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0, samples: 0, resets: 0 };
    entry.input += delta.input;
    entry.cachedInput += delta.cachedInput;
    entry.output += delta.output;
    entry.reasoning += delta.reasoning;
    entry.total += delta.total != null ? delta.total : (delta.input + delta.output);
    entry.samples += 1;
    if (wasReset) entry.resets += 1;
    samples[model] = entry;
    usageCount += 1;
    computed.snapshots += 1;
    computed.input += delta.input;
    computed.cachedInput += delta.cachedInput;
    computed.output += delta.output;
    computed.reasoning += delta.reasoning;
    computed.total += delta.total != null ? delta.total : (delta.input + delta.output);
  }
  if (resetCount) warnings.push(`global cumulative reset detected ${resetCount} time(s); measured coverage is incomplete`);
  return {
    state: { ...previousState, samples, globalLast: previousGlobal, usageCount, latestUsageTimestamp, resetCount },
    added: computed,
    warnings
  };
}

function aggregateCodexFiles(files) {
  const models = {};
  for (const fileState of Object.values(files || {})) {
    for (const [model, value] of Object.entries(fileState.samples || {})) {
      const entry = models[model] || { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0, samples: 0, resets: 0 };
      entry.input += value.input || 0;
      entry.cachedInput += value.cachedInput || 0;
      entry.output += value.output || 0;
      entry.reasoning += value.reasoning || 0;
      entry.total += value.total || 0;
      entry.samples += value.samples || 0;
      entry.resets += value.resets || 0;
      models[model] = entry;
    }
  }
  return models;
}

function defaultSessionsDir() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'sessions');
}

function findJsonlFiles(directory) {
  const found = [];
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(full);
    }
  };
  walk(directory);
  return found;
}

function isInside(child, parent) {
  if (!child || !parent) return false;
  let relative;
  try {
    relative = path.relative(path.resolve(parent), path.resolve(child));
  } catch (error) {
    return false;
  }
  if (relative === '') return true;
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return true;
}

function projectRoots(root) {
  return [root, path.resolve(root, '..', 'DesignerAPI')];
}

function syncUsage(options = {}) {
  const dirs = layout(options.root);
  let chatFilter = null;
  if (options.chatId != null) chatFilter = requireSafeId(options.chatId, 'chat id');
  ensureUsageLayout(dirs);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const clock = Number.isFinite(now) ? now : Date.now();
  const sessionsDir = options.sessionsDir ? path.resolve(options.sessionsDir) : defaultSessionsDir();
  if (!sessionsDir || !fs.existsSync(sessionsDir)) {
    return { ok: true, source: 'unknown', updatedAt: nowIso(clock), sessionsDir, synced: [], warnings: ['Codex sessions directory unavailable; measured GPT usage is unknown'] };
  }
  let files = findJsonlFiles(sessionsDir);
  if (chatFilter) {
    const matching = files.filter((file) => path.basename(file).toLowerCase().includes(chatFilter.toLowerCase()));
    if (matching.length) files = matching;
  }
  const projects = projectRoots(dirs.root);
  const synced = [];
  const warnings = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = parseCodexUsage(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      warnings.push(`unreadable:${path.basename(file)}`);
      continue;
    }
    if (!parsed.chatId) continue;
    if (chatFilter) {
      if (parsed.chatId !== chatFilter) continue;
    } else if (!parsed.cwd || !projects.some((project) => isInside(parsed.cwd, project))) {
      continue;
    }
    const safeChat = sanitizeId(parsed.chatId);
    if (!safeChat) {
      warnings.push('unsafe-chat-id');
      continue;
    }
    const statePath = path.join(dirs.codex, `${safeChat}.json`);
    const previous = readJson(statePath) || { chatId: parsed.chatId, files: {}, models: {}, warnings: [] };
    const fileKey = path.resolve(file).toLowerCase();
    const files = { ...(previous.files || {}) };
    const fileState = files[fileKey] || {};
    const applied = computeCodexDeltas(fileState, parsed);
    files[fileKey] = applied.state;
    let latestSourceTimestamp = previous.latestSourceTimestamp || null;
    for (const fileUsage of Object.values(files)) {
      if (fileUsage.latestUsageTimestamp && (!latestSourceTimestamp || String(fileUsage.latestUsageTimestamp) > String(latestSourceTimestamp))) {
        latestSourceTimestamp = fileUsage.latestUsageTimestamp;
      }
    }
    const next = {
      chatId: parsed.chatId,
      cwd: parsed.cwd || previous.cwd || null,
      source: 'codex',
      updatedAt: nowIso(clock),
      latestSourceTimestamp,
      coverage: 'so-far',
      files,
      models: aggregateCodexFiles(files),
      warnings: [...(previous.warnings || []).filter((warning) => !String(warning).includes('reset')), ...applied.warnings].slice(-10)
    };
    writeJsonAtomic(statePath, next);
    synced.push({ chatId: parsed.chatId, statePath, added: applied.added, warnings: applied.warnings });
  }
  rebuild(dirs, { now: clock });
  return { ok: true, source: 'codex', updatedAt: nowIso(clock), sessionsDir, synced, warnings };
}

function externalRunId(record) {
  if (record.id) return `ext-${requireSafeId(record.id, 'run id')}`;
  const signature = ['external', record.chatId || '', record.provider || '', record.model || '', record.startedAt || '', record.finishedAt || '', Date.now(), crypto.randomBytes(4).toString('hex')].join('|');
  return `ext-${stableHash(signature).slice(0, 16)}`;
}

function recordExternalRun(options = {}) {
  const dirs = layout(options.root);
  if (!options.model) throw new Error('recordExternalRun requires a model');
  const rawChatId = getChatId(options.chatId);
  let chatId = null;
  if (rawChatId != null) chatId = requireSafeId(rawChatId, 'chat id');
  ensureUsageLayout(dirs);
  const settings = loadSettings(dirs);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const runId = externalRunId({ ...options, chatId });
  const metadataPath = path.join(dirs.runs, `${runId}.json`);
  const previous = readJson(metadataPath);
  const inputTokens = tokenNumber(options.inputTokens);
  const outputTokens = tokenNumber(options.outputTokens);
  const totalTokens = tokenNumber(options.totalTokens);
  const reasoningTokens = tokenNumber(options.reasoningTokens);
  const cacheRead = tokenNumber(options.cacheReadTokens);
  const cacheWrite = tokenNumber(options.cacheWriteTokens);
  const usageKnown = [inputTokens, outputTokens, totalTokens, reasoningTokens, cacheRead, cacheWrite].some((value) => value != null);
  const promptChars = tokenNumber(options.promptChars);
  const evidenceChars = tokenNumber(options.evidenceChars);
  const visibleOutputTokens = tokenNumber(options.visibleOutputTokens);
  const explicitWorkload = tokenNumber(options.workloadTokens);
  const hasFeatures = [promptChars, evidenceChars, visibleOutputTokens, explicitWorkload].some((value) => value != null);
  const features = hasFeatures ? {
    promptChars,
    promptHash: options.prompt ? stableHash(options.prompt) : null,
    evidenceChars,
    evidenceCount: tokenNumber(options.evidenceCount) || 0,
    evidenceHashes: [],
    visibleOutputTokens,
    workloadTokens: explicitWorkload != null ? explicitWorkload : null
  } : null;
  if (features && features.workloadTokens == null) {
    const charTokens = (promptChars != null || evidenceChars != null) ? Math.ceil(((promptChars || 0) + (evidenceChars || 0)) / settings.charsPerToken) : null;
    features.workloadTokens = charTokens != null && visibleOutputTokens != null ? charTokens + visibleOutputTokens : null;
  }
  const startedEpoch = toEpoch(options.startedAt);
  const finishedEpoch = toEpoch(options.finishedAt);
  const run = {
    id: runId,
    schemaVersion: SCHEMA_VERSION,
    source: options.provider || 'external',
    chatId,
    attributed: Boolean(chatId),
    provider: options.provider || 'external',
    agent: options.agent || null,
    model: options.model,
    session: options.session || null,
    status: options.status || 'unknown',
    quality: previous?.quality && previous.quality !== 'unreviewed' ? previous.quality : 'unreviewed',
    title: shortText(options.taskTitle, 80) || options.provider || 'external',
    taskTitle: options.taskTitle ? shortText(options.taskTitle, 80) : null,
    taskKind: shortLabel(options.taskKind) || 'unknown',
    startedAt: startedEpoch != null ? nowIso(startedEpoch) : null,
    finishedAt: finishedEpoch != null ? nowIso(finishedEpoch) : null,
    recordedAt: nowIso(now),
    durationMs: tokenNumber(options.durationMs) ?? (startedEpoch != null && finishedEpoch != null ? Math.max(0, finishedEpoch - startedEpoch) : null),
    receiptPath: options.receiptPath || null,
    transcriptPath: options.transcriptPath || null,
    usage: {
      total: totalTokens,
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens,
      cacheRead,
      cacheWrite,
      cost: null,
      complete: usageKnown && [inputTokens, outputTokens, totalTokens].every((value) => value != null),
      available: usageKnown
    },
    tools: { total: 0, completed: 0, failed: 0, unknown: 0 },
    features,
    reportChars: options.reportChars != null ? tokenNumber(options.reportChars) : null,
    reportTokens: options.reportChars != null ? Math.ceil((tokenNumber(options.reportChars) || 0) / settings.charsPerToken) : null,
    review: previous?.review || null,
    reviews: Array.isArray(previous?.reviews) ? previous.reviews : [],
    estimate: previous?.estimate || null
  };
  writeJsonAtomic(metadataPath, run);
  rebuild(dirs, { now });
  return { id: runId, metadataPath, run, chatPath: chatId ? path.join(dirs.chats, `${chatId}.md`) : null };
}

function computeEstimate(run, settings) {
  const features = run.features || null;
  if (!features && !run.reportChars) return null;
  const promptTokens = features?.promptChars != null ? Math.ceil(features.promptChars / settings.charsPerToken) : null;
  const reportTokens = run.reportChars != null ? Math.ceil(run.reportChars / settings.charsPerToken) : null;
  const review = run.review || null;
  const explicitOverhead = review?.gptOverheadTokens != null ? review.gptOverheadTokens : null;
  const repairs = review?.repairs != null ? review.repairs : 0;
  const allowance = settings.reviewAllowanceTokens * (1 + repairs);
  const overhead = explicitOverhead != null
    ? explicitOverhead
    : (promptTokens != null || reportTokens != null)
      ? (promptTokens || 0) + (reportTokens || 0) + allowance
      : null;
  const workload = features?.workloadTokens != null ? features.workloadTokens : null;
  const outcome = review?.outcome || 'unreviewed';
  const grossLow = workload != null ? workload * settings.counterfactualLow : null;
  const grossHigh = workload != null ? workload * settings.counterfactualHigh : null;
  const netLow = grossLow != null && overhead != null ? grossLow - overhead : null;
  const netHigh = grossHigh != null && overhead != null ? grossHigh - overhead : null;
  const reviewed = outcome !== 'unreviewed';
  const credit = reviewed && REVIEW_CREDIT[outcome] != null ? REVIEW_CREDIT[outcome] : null;
  const applicable = outcome !== 'not-applicable';
  const creditedLow = reviewed && applicable && grossLow != null && overhead != null ? grossLow * credit - overhead : null;
  const creditedHigh = reviewed && applicable && grossHigh != null && overhead != null ? grossHigh * credit - overhead : null;
  const creditedNetLow = creditedLow === 0 ? 0 : creditedLow;
  const creditedNetHigh = creditedHigh === 0 ? 0 : creditedHigh;
  return {
    workloadTokens: workload,
    promptTokens,
    reportTokens,
    overheadTokens: overhead,
    grossLow,
    grossHigh,
    counterfactualLow: grossLow,
    counterfactualHigh: grossHigh,
    netLow,
    netHigh,
    outcome,
    credit,
    reviewed,
    applicable,
    creditedNetLow,
    creditedNetHigh,
    potentialNetLow: !reviewed && netLow != null ? netLow : null,
    potentialNetHigh: !reviewed && netHigh != null ? netHigh : null
  };
}

function formatNumber(value) {
  if (value == null) return 'unknown';
  return typeof value === 'number' ? new Intl.NumberFormat('en-US', { notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0 }).format(value) : 'unknown';
}

function formatRange(low, high) {
  if (low == null || high == null) return 'unknown';
  return `${formatNumber(low)} to ${formatNumber(high)}`;
}

function formatChatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' }).format(date) + ' ART';
}

function relativeLink(fromDir, target) {
  if (!target) return null;
  let relative = path.relative(fromDir, target);
  if (!relative || relative.startsWith('..')) relative = target;
  return relative.split(path.sep).join('/');
}

function buildChatMarkdown({ chatId, dirs, runs, codexState, chatState, settings, now, catalogMeta }) {
  const lines = [];
  const gpt = { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0, models: {}, available: false };
  if (codexState?.models && Object.keys(codexState.models).length) {
    for (const [model, value] of Object.entries(codexState.models)) {
      gpt.input += value.input || 0;
      gpt.cachedInput += value.cachedInput || 0;
      gpt.output += value.output || 0;
      gpt.reasoning += value.reasoning || 0;
      gpt.total += value.total || 0;
      gpt.models[model] = value;
    }
    gpt.available = true;
  }
  const counts = { accepted: 0, reworked: 0, rejected: 0, unreviewed: 0, 'not-applicable': 0 };
  const ever = { rework: 0, rejection: 0 };
  const byModel = {};
  const stats = { calls: runs.length, tokens: 0, unknown: 0, partial: 0, completed: 0, failed: 0 };
  let creditedLow = 0;
  let creditedHigh = 0;
  let potentialLow = 0;
  let potentialHigh = 0;
  let creditedSamples = 0;
  let potentialSamples = 0;
  for (const run of runs) {
    const outcome = run.review?.outcome || 'unreviewed';
    if (counts[outcome] != null) counts[outcome]++;
    const history = Array.isArray(run.reviews) ? run.reviews : [];
    if (history.some((review) => review.outcome === 'reworked') || outcome === 'reworked') ever.rework++;
    if (history.some((review) => review.outcome === 'rejected') || outcome === 'rejected') ever.rejection++;
    const modelKey = run.model || 'unknown';
    const modelRow = byModel[modelKey] || { calls: 0, tokens: 0, unknown: 0, accepted: 0, reworked: 0, rejected: 0, unreviewed: 0 };
    modelRow.calls++;
    const anyTokenKnown = ['total', 'input', 'output'].some((tokenKey) => run.usage?.[tokenKey] != null);
    if (anyTokenKnown) {
      if (run.usage.total != null) {
        stats.tokens += run.usage.total;
        modelRow.tokens += run.usage.total;
      }
      if (run.usage.complete === false || run.usage.total == null) stats.partial++;
    } else {
      stats.unknown++;
      modelRow.unknown++;
    }
    if (modelRow[outcome] != null) modelRow[outcome]++;
    if (run.status === 'completed') stats.completed++;
    else if (run.status === 'failed') stats.failed++;
    byModel[modelKey] = modelRow;
    const estimate = computeEstimate(run, settings);
    if (estimate) {
      if (estimate.creditedNetLow != null) {
        creditedLow += estimate.creditedNetLow;
        creditedHigh += estimate.creditedNetHigh;
        creditedSamples++;
      }
      if (estimate.potentialNetLow != null) {
        potentialLow += estimate.potentialNetLow;
        potentialHigh += estimate.potentialNetHigh;
        potentialSamples++;
      }
    }
  }
  const title = chatState?.title || runs.find((run) => run.title)?.title || 'Codex chat';
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Chat id: ${chatId}`);
  lines.push(`Updated: ${formatChatTime(now)}`);
  if (chatState?.note) lines.push(`Review: ${shortText(chatState.note, 160)}`);
  const coverageBits = [`GPT coverage: ${codexState?.coverage || 'unknown'}`];
  if (codexState?.latestSourceTimestamp) coverageBits.push(`latest usage ${formatChatTime(codexState.latestSourceTimestamp)}`);
  lines.push(coverageBits.join(' · '));
  lines.push('Recorded-only history: older receipts without chat ids are not assigned here.');
  lines.push('');
  if (gpt.available) {
    lines.push(`Measured GPT: uncached in ${formatNumber(gpt.input - gpt.cachedInput)} · cached ${formatNumber(gpt.cachedInput)} · out ${formatNumber(gpt.output)} · reasoning subset ${formatNumber(gpt.reasoning)}`);
    const modelRows = Object.entries(gpt.models);
    if (modelRows.length) {
      lines.push('| model | uncached in | cached | out |');
      lines.push('| --- | --- | --- | --- |');
      for (const [model, value] of modelRows.slice(0, 4)) {
        lines.push(`| ${model} | ${formatNumber(Math.max(0, (value.input || 0) - (value.cachedInput || 0)))} | ${formatNumber(value.cachedInput || 0)} | ${formatNumber(value.output || 0)} |`);
      }
    }
  } else {
    lines.push('Measured GPT: unknown (no local Codex session metadata found)');
  }
  lines.push('');
  const requests = buildRequestEfficiency(runs);
  lines.push(`Delegated: ${stats.calls} assignments · observed model steps ${requests.completedSteps} (lower bound; ${requests.unknownRuns} unknown) · completed ${stats.completed} · failed ${stats.failed}`);
  lines.push(`Measured delegated tokens: ${formatNumber(stats.tokens)} · unknown ${stats.unknown} · partial telemetry ${stats.partial}`);
  const modelEntries = Object.entries(byModel);
  if (modelEntries.length) {
    lines.push('| model | assignments | tokens | accepted | reworked | rejected | unreviewed |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const [model, value] of modelEntries.slice(0, 6)) {
      lines.push(`| ${model} | ${value.calls} | ${formatNumber(value.tokens)} | ${value.accepted} | ${value.reworked} | ${value.rejected} | ${value.unreviewed} |`);
    }
  }
  lines.push('');
  lines.push(`Quality: accepted ${counts.accepted} · reworked ${counts.reworked} · rejected ${counts.rejected} · unreviewed ${counts.unreviewed} · n/a ${counts['not-applicable']}`);
  if (ever.rework || ever.rejection) lines.push(`Prior signals retained: rework ${ever.rework} · rejection ${ever.rejection}`);
  const estimateParts = [`Estimated GPT tokens avoided (net, reviewed): ${creditedSamples ? formatRange(creditedLow, creditedHigh) : 'none yet'}`];
  if (potentialSamples) estimateParts.push(`potential (unreviewed): ${formatRange(potentialLow, potentialHigh)}`);
  lines.push(estimateParts.join(' · '));
  lines.push('Heuristic counterfactual only; not observed GPT savings.');
  const catalogBits = [`Catalog: ${catalogMeta?.lastStatus || 'unknown'}`];
  if (catalogMeta?.modelCount != null) catalogBits.push(`${catalogMeta.modelCount} models`);
  if (catalogMeta?.lastCheckedAt) catalogBits.push(`checked ${formatChatTime(catalogMeta.lastCheckedAt)}`);
  lines.push(catalogBits.join(' · '));
  if (codexState?.warnings?.length) lines.push(`Coverage warning: ${codexState.warnings.slice(-2).join('; ')}`);
  lines.push('');
  const recent = [...runs].sort((a, b) => String(b.finishedAt || b.recordedAt || '').localeCompare(String(a.finishedAt || a.recordedAt || ''))).slice(0, MAX_RECENT_CALLS);
  lines.push(`Recent calls (${recent.length} of ${runs.length}):`);
  if (!recent.length) lines.push('- none recorded');
  for (const run of recent) {
    const estimate = computeEstimate(run, settings);
    const links = [`[details](${relativeLink(dirs.chats, path.join(dirs.runs, `${run.id}.json`))})`];
    if (run.receiptPath) links.push(`[receipt](${relativeLink(dirs.chats, run.receiptPath)})`);
    if (run.transcriptPath) links.push(`[transcript](${relativeLink(dirs.chats, run.transcriptPath)})`);
    let estimateText = '';
    if (estimate?.reviewed && estimate.creditedNetLow != null) estimateText = ` · net ${formatRange(estimate.creditedNetLow, estimate.creditedNetHigh)}`;
    else if (estimate?.potentialNetLow != null) estimateText = ' · uncredited';
    const telemetryFlag = !run.usage
      ? ' · telemetry unknown'
      : (run.usage.total == null && run.usage.input == null && run.usage.output == null)
        ? ' · telemetry unknown'
        : (run.usage.complete === false ? ' · partial' : '');
    lines.push(`- ${run.taskTitle || run.id}: ${run.model || 'unknown'} · ${run.review?.outcome || 'unreviewed'}${estimateText}${telemetryFlag} ${links[0] || ''}`);
  }
  if (!runs.length) lines.push('- none recorded');
  return `${lines.join('\n')}\n`;
}

function buildRequestEfficiency(runs) {
  const result = { assignments: 0, completedSteps: 0, unknownRuns: 0, byUtcDay: {}, byModel: {}, limitation: 'Observed completed generation steps only, not an exact server request/quota counter. Retries, background/title/compaction calls, desktop activity and other devices can be missing. Unknown dates are not assigned to a day. No exact quota remaining is inferred.' };
  for (const run of runs.filter((item) => item.source === 'opencode')) {
    result.assignments++;
    const model = run.model || 'unknown';
    const row = result.byModel[model] ||= { assignments: 0, completedSteps: 0, unknownRuns: 0, failed: 0, accepted: 0, acceptedWithStepTelemetry: 0, stepsAcrossMeasuredAcceptedRuns: 0, stepsPerMeasuredAcceptedRun: null, allObservedStepsPerAcceptedResult: null };
    row.assignments++;
    if (run.status === 'failed') row.failed++;
    const accepted = run.review?.outcome === 'accepted';
    if (accepted) row.accepted++;
    const steps = run.generation?.completedSteps;
    if (!Number.isInteger(steps) || steps < 0) { row.unknownRuns++; result.unknownRuns++; continue; }
    result.completedSteps += steps;
    row.completedSteps += steps;
    if (accepted) { row.acceptedWithStepTelemetry++; row.stepsAcrossMeasuredAcceptedRuns += steps; }
    const days = run.generation.byUtcDay || { unknown: steps };
    for (const [day, count] of Object.entries(days)) {
      if (!Number.isInteger(count) || count < 0) continue;
      const daily = result.byUtcDay[day] ||= {};
      daily[model] = (daily[model] || 0) + count;
    }
  }
  for (const row of Object.values(result.byModel)) {
    row.stepsPerMeasuredAcceptedRun = row.acceptedWithStepTelemetry ? row.stepsAcrossMeasuredAcceptedRuns / row.acceptedWithStepTelemetry : null;
    row.allObservedStepsPerAcceptedResult = row.accepted && !row.unknownRuns ? row.completedSteps / row.accepted : null;
  }
  return result;
}

function backfillGeneration(dirs) {
  for (const file of listJsonFiles(dirs.runs)) {
    const run = readJson(file);
    if (run?.source !== 'opencode' || run.generation || !run.transcriptPath) continue;
    const transcript = path.resolve(run.transcriptPath);
    if (!isInside(transcript, path.join(dirs.root, '.opencode/runs'))) continue;
    try {
      const parsed = parseOpenCodeTranscript(fs.readFileSync(transcript, 'utf8'));
      run.generation = { completedSteps: parsed.steps, byUtcDay: parsed.stepsByUtcDay, coverage: parsed.steps ? 'observed-lower-bound' : 'no-completed-steps-observed' };
      writeJsonAtomic(file, run);
    } catch {}
  }
}

function buildObservations(runs, settings = DEFAULT_SETTINGS) {
  const observations = {};
  for (const run of runs) {
    const model = run.model || 'unknown';
    const kind = run.taskKind || 'unknown';
    observations[model] = observations[model] || {};
    const obs = observations[model][kind] || {
      calls: 0,
      observedSteps: 0,
      knownStepRuns: 0,
      unknownStepRuns: 0,
      reviewedSamples: 0,
      validatedSamples: 0,
      estimatedGptOverheadTokens: 0,
      overheadSamples: 0,
      accepted: 0,
      reworked: 0,
      rejected: 0,
      unreviewed: 0,
      notApplicable: 0,
      repairs: 0,
      defects: 0,
      reworkSignals: 0,
      rejectionSignals: 0,
      telemetryUnknown: 0,
      telemetryPartial: 0,
      measuredTokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      elapsedMsTotal: 0,
      elapsedSamples: 0
    };
    const outcome = run.review?.outcome || 'unreviewed';
    if (run.review?.validation && !['unreviewed', 'not-applicable'].includes(outcome)) obs.validatedSamples++;
    const estimate = computeEstimate(run, settings);
    if (estimate?.overheadTokens != null) {
      obs.estimatedGptOverheadTokens += estimate.overheadTokens;
      obs.overheadSamples++;
    }
    const history = Array.isArray(run.reviews) ? run.reviews : [];
    obs.calls++;
    if (Number.isInteger(run.generation?.completedSteps)) {
      obs.observedSteps += run.generation.completedSteps;
      obs.knownStepRuns++;
    } else obs.unknownStepRuns++;
    if (outcome === 'accepted') { obs.accepted++; obs.reviewedSamples++; }
    else if (outcome === 'reworked') { obs.reworked++; obs.reviewedSamples++; }
    else if (outcome === 'rejected') { obs.rejected++; obs.reviewedSamples++; }
    else if (outcome === 'not-applicable') obs.notApplicable++;
    else obs.unreviewed++;
    if (outcome === 'reworked' || history.some((review) => review.outcome === 'reworked')) obs.reworkSignals++;
    if (outcome === 'rejected' || history.some((review) => review.outcome === 'rejected')) obs.rejectionSignals++;
    obs.repairs += run.review?.repairs || 0;
    obs.defects += run.review?.defects || 0;
    if (run.usage) {
      const anyTokenKnown = ['total', 'input', 'output'].some((tokenKey) => run.usage[tokenKey] != null);
      if (!anyTokenKnown) obs.telemetryUnknown += 1;
      else if (run.usage.complete === false) obs.telemetryPartial += 1;
      for (const tokenKey of ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite', 'total']) {
        if (run.usage[tokenKey] != null) obs.measuredTokens[tokenKey] += run.usage[tokenKey];
      }
    } else {
      obs.telemetryUnknown += 1;
    }
    if (run.durationMs != null) {
      obs.elapsedMsTotal += run.durationMs;
      obs.elapsedSamples++;
    }
    observations[model][kind] = obs;
  }
  return observations;
}

function buildSuggestions(observations, settings, catalogMeta, limitation) {
  const suggestions = [];
  for (const [model, kinds] of Object.entries(observations)) {
    for (const [kind, obs] of Object.entries(kinds)) {
      if (obs.rejectionSignals > 0) {
        suggestions.push({ type: 'investigate', model, taskKind: kind, message: `${model} has ${obs.rejectionSignals} ${kind} rejection signal(s) across review history; investigate before continuing automatic routing.`, evidence: { rejectionSignals: obs.rejectionSignals, rejected: obs.rejected, reviewedSamples: obs.reviewedSamples } });
      }
      if (obs.reworkSignals > 0 && obs.reviewedSamples >= settings.minReviewedSamples) {
        suggestions.push({ type: 'quality', model, taskKind: kind, message: `${model} shows ${obs.reworkSignals} ${kind} rework signal(s); keep review overhead in view for comparable work.`, evidence: { reworkSignals: obs.reworkSignals, repairs: obs.repairs, reviewedSamples: obs.reviewedSamples } });
      }
      if (obs.reviewedSamples >= settings.minReviewedSamples && obs.validatedSamples >= settings.minReviewedSamples) {
        const acceptance = obs.accepted / obs.reviewedSamples;
        if (acceptance >= 0.8 && obs.defects === 0 && obs.repairs === 0 && obs.reworkSignals === 0 && obs.rejectionSignals === 0) {
          suggestions.push({ type: 'routing', model, taskKind: kind, message: `${kind} on ${model} shows ${Math.round(acceptance * 100)}% acceptance over ${obs.reviewedSamples} reviewed samples; consider preferring it for comparable work.`, evidence: { acceptance, reviewedSamples: obs.reviewedSamples } });
        } else if (acceptance < 0.5) {
          suggestions.push({ type: 'routing', model, taskKind: kind, message: `${kind} on ${model} shows ${Math.round(acceptance * 100)}% acceptance over ${obs.reviewedSamples} reviewed samples; consider routing comparable work elsewhere.`, evidence: { acceptance, reviewedSamples: obs.reviewedSamples } });
        }
      }
    }
  }
  const changes = catalogMeta?.lastChanges;
  if (changes) {
    for (const id of changes.added || []) suggestions.push({ type: 'catalog', model: id, message: `New catalog model ${id}; compare before scoped adoption.` });
    for (const id of changes.removed || []) suggestions.push({ type: 'catalog', model: id, message: `Catalog model ${id} was removed; verify any routing references.` });
    for (const id of changes.becamePaid || []) suggestions.push({ type: 'catalog', model: id, message: `Catalog model ${id} changed from free to paid; do not route automatically without explicit approval.` });
    for (const id of changes.becameFree || []) suggestions.push({ type: 'catalog', model: id, message: `Catalog model ${id} changed to free; verify pricing before selection.` });
  }
  if (limitation.unattributed > 0) suggestions.push({ type: 'attribution', message: `${limitation.unattributed} delegated call(s) lack a chat id and are excluded from per-chat estimates.` });
  if (limitation.unreviewed > 0) suggestions.push({ type: 'review', message: `${limitation.unreviewed} unreviewed call(s); review outcomes rather than trusting token volume.` });
  return suggestions;
}

function buildOptimization({ dirs, runs, settings, catalogMeta, catalogSnapshot, now, chatStates = [], codexStates = [] }) {
  const observations = buildObservations(runs, settings);
  const codexUsage = { chats: codexStates.length, byModel: {}, uncachedPlusOutputTokens: 0, scope: 'Available per-chat Codex snapshots so far; delegated tracking may cover a shorter period. Cached input and reasoning output are subsets, not extra tokens. No billing or quota equivalence is inferred.' };
  for (const state of codexStates) {
    for (const [model, tokens] of Object.entries(state.models || {})) {
      const aggregate = codexUsage.byModel[model] || { uncachedInput: 0, cachedInput: 0, output: 0, reasoningSubset: 0 };
      const uncached = Math.max(0, (tokens.input || 0) - (tokens.cachedInput || 0));
      aggregate.uncachedInput += uncached;
      aggregate.cachedInput += tokens.cachedInput || 0;
      aggregate.output += tokens.output || 0;
      aggregate.reasoningSubset += tokens.reasoning || 0;
      codexUsage.uncachedPlusOutputTokens += uncached + (tokens.output || 0);
      codexUsage.byModel[model] = aggregate;
    }
  }
  const limitation = {
    unattributed: runs.filter((run) => !run.attributed).length,
    unreviewed: runs.filter((run) => !run.review || run.review.outcome === 'unreviewed').length,
    unknownQualityPolicy: 'Unknown quality never implies efficiency; review before any routing change.',
    telemetryPolicy: 'Partial or missing OpenCode telemetry is stored as null, never as authoritative zeros.',
    auxiliaryCalls: 'OpenCode step telemetry may omit background title/compaction calls; model IDs come from the invocation receipt.',
    estimateConfidence: 'Uncalibrated scenario range, not a statistical confidence interval. Cross-run overlap and repair work can overstate hypothetical benefits; override GPT overhead when known.',
    measuredCounterfactual: 'GPT workload estimates are heuristic; no exact dollar, billing, or subscription savings are inferred.',
    coverage: 'Recorded-only history: delegated runs without chat ids are excluded from per-chat estimates and never assigned implicitly.'
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(now),
    estimator: {
      settings: { ...settings },
      formula: 'workload = unique prompt/evidence chars / charsPerToken + visible output tokens; gross = workload * counterfactual factor (settings.counterfactualLow..High); overhead = prompt tokens + report tokens + reviewAllowanceTokens * (1 + repairs) unless an explicit gptOverheadTokens is supplied; credited NET = gross * credit - overhead with credit accepted 1, reworked 0.5, rejected 0, unreviewed uncredited (null), not-applicable excluded; negative NET values are preserved.'
    },
    observations,
    requestEfficiency: buildRequestEfficiency(runs),
    activeCooldowns: listJsonFiles(path.join(dirs.data, 'cooldowns')).map(readJson).filter((entry) => entry && Number.isFinite(entry.retryAt) && entry.retryAt > toEpoch(nowIso(now))).map((entry) => ({ model: entry.model, retryAt: new Date(entry.retryAt).toISOString(), reason: entry.reason, source: entry.source, blockedAttempts: entry.attempts || 0 })),
    codexUsage,
    latestChatReviews: chatStates.filter((state) => state.note).sort((a, b) => String(b.reviewedThroughAt || '').localeCompare(String(a.reviewedThroughAt || ''))).slice(0, 5).map((state) => ({ chatId: state.chatId, title: state.title || null, reviewedThroughAt: state.reviewedThroughAt, note: state.note })),
    catalog: {
      snapshotAt: catalogSnapshot?.savedAt || null,
      lastCheckedAt: catalogMeta?.lastCheckedAt || null,
      status: catalogMeta?.lastStatus || 'unknown',
      modelCount: catalogMeta?.modelCount ?? null,
      diffs: catalogMeta?.lastChanges || null
    },
    limitations: limitation,
    suggestions: buildSuggestions(observations, settings, catalogMeta, limitation)
  };
}

function buildSummaryMarkdown(runs, codexStates, settings, now) {
  let gptUncached = 0;
  let gptCached = 0;
  let gptOutput = 0;
  for (const state of codexStates) {
    for (const value of Object.values(state.models || {})) {
      gptUncached += Math.max(0, (value.input || 0) - (value.cachedInput || 0));
      gptCached += value.cachedInput || 0;
      gptOutput += value.output || 0;
    }
  }
  let delegatedTotal = 0;
  for (const run of runs) if (run.usage?.available) delegatedTotal += run.usage.total || 0;
  const outcomes = { accepted: 0, reworked: 0, rejected: 0, unreviewed: 0, 'not-applicable': 0 };
  for (const run of runs) {
    const outcome = run.review?.outcome || 'unreviewed';
    if (outcomes[outcome] != null) outcomes[outcome]++;
  }
  const lines = [
    '# Usage summary',
    '',
    `Updated: ${nowIso(now)}`,
    `Chats with local Codex metadata: ${codexStates.length}`,
    `Measured GPT uncached input: ${formatNumber(gptUncached)} · cached input: ${formatNumber(gptCached)} · output: ${formatNumber(gptOutput)}`,
    `Delegated assignments: ${runs.length} · observed model steps: ${buildRequestEfficiency(runs).completedSteps} (lower bound) · measured delegated tokens: ${formatNumber(delegatedTotal)}`,
    `Quality: accepted ${outcomes.accepted} · reworked ${outcomes.reworked} · rejected ${outcomes.rejected} · unreviewed ${outcomes.unreviewed} · n/a ${outcomes['not-applicable']}`,
    '',
    `Heuristic counterfactual only; no exact GPT savings, billing, or quota claims. See optimization.json for observations.`
  ];
  return `${lines.join('\n')}\n`;
}

function rebuild(dirs, options = {}) {
  ensureUsageLayout(dirs);
  backfillGeneration(dirs);
  const settings = loadSettings(dirs);
  const clock = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const runs = listJsonFiles(dirs.runs).map((file) => readJson(file)).filter(Boolean);
  const codexStates = listJsonFiles(dirs.codex).map((file) => readJson(file)).filter(Boolean);
  const chatStates = listJsonFiles(dirs.chatState).map((file) => readJson(file)).filter(Boolean);
  const catalogMeta = readJson(dirs.catalogMeta);
  const catalogSnapshot = readJson(dirs.catalog);
  const codexByChat = {};
  for (const state of codexStates) if (state.chatId) codexByChat[state.chatId] = state;
  const chatStateByChat = {};
  for (const state of chatStates) if (state.chatId) chatStateByChat[state.chatId] = state;
  const runsByChat = {};
  for (const run of runs) {
    if (!run.attributed || !run.chatId) continue;
    runsByChat[run.chatId] = runsByChat[run.chatId] || [];
    runsByChat[run.chatId].push(run);
  }
  const chatIds = new Set([...Object.keys(runsByChat), ...Object.keys(codexByChat), ...Object.keys(chatStateByChat)]);
  const written = [];
  for (const chatId of chatIds) {
    const dirname = sanitizeId(chatId);
    if (!dirname) continue;
    const markdown = buildChatMarkdown({ chatId, dirs, runs: runsByChat[chatId] || [], codexState: codexByChat[chatId] || null, chatState: chatStateByChat[chatId] || null, settings, now: clock, catalogMeta });
    const file = path.join(dirs.chats, `${dirname}.md`);
    writeFileAtomic(file, markdown);
    written.push(file);
  }
  const optimization = buildOptimization({ dirs, runs, settings, catalogMeta, catalogSnapshot, now: clock, chatStates, codexStates });
  writeJsonAtomic(dirs.optimization, optimization);
  const index = [...chatIds].sort((a, b) => String(chatStateByChat[b]?.reviewedThroughAt || codexByChat[b]?.updatedAt || '').localeCompare(String(chatStateByChat[a]?.reviewedThroughAt || codexByChat[a]?.updatedAt || ''))).slice(0, 100).map((id) => `- [${chatStateByChat[id]?.title || `Chat ${id.slice(0, 8)}`}](${path.join(dirs.chats, `${sanitizeId(id)}.md`).split(path.sep).join('/')})`);
  writeFileAtomic(dirs.summary, buildSummaryMarkdown(runs, codexStates, settings, clock) + '\nChats:\n' + index.join('\n') + '\n');
  return { chatFiles: written, optimizationPath: dirs.optimization, summaryPath: dirs.summary, runCount: runs.length };
}

function reviewRun(options = {}) {
  const runId = requireSafeId(options.runId, 'run id');
  if (!OUTCOMES.includes(options.outcome)) throw new Error(`Invalid outcome: ${options.outcome}`);
  const dirs = layout(options.root);
  ensureUsageLayout(dirs);
  const settings = loadSettings(dirs);
  const file = path.join(dirs.runs, `${runId}.json`);
  const run = readJson(file);
  if (!run) throw new Error(`Unknown run: ${runId}`);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  const repairs = options.repairs == null ? null : tokenNumber(options.repairs);
  const defects = options.defects == null ? null : tokenNumber(options.defects);
  if (options.repairs != null && repairs == null) throw new Error('repairs must be a non-negative number');
  if (options.defects != null && defects == null) throw new Error('defects must be a non-negative number');
  const gptOverheadTokens = options.gptOverheadTokens == null ? null : tokenNumber(options.gptOverheadTokens);
  if (options.gptOverheadTokens != null && gptOverheadTokens == null) throw new Error('gptOverheadTokens must be a non-negative number');
  const previousReview = run.review || {};
  const entry = {
    at: nowIso(now),
    outcome: options.outcome,
    validation: options.validation ? shortText(options.validation, 60) : null,
    repairs: repairs != null ? repairs : (previousReview.repairs ?? null),
    defects: defects != null ? defects : (previousReview.defects ?? null),
    gptOverheadTokens: gptOverheadTokens != null ? gptOverheadTokens : (previousReview.gptOverheadTokens ?? null),
    note: options.note ? shortText(options.note, 120) : null
  };
  run.reviews = Array.isArray(run.reviews) ? [...run.reviews, entry] : [entry];
  run.review = { ...entry };
  run.quality = options.outcome;
  run.estimate = computeEstimate(run, settings);
  writeJsonAtomic(file, run);
  rebuild(dirs, { now });
  return { run, metadataPath: file, reviews: run.reviews.length };
}

function finishChat(options = {}) {
  const chatId = requireSafeId(options.chatId, 'chat id');
  const dirs = layout(options.root);
  ensureUsageLayout(dirs);
  const now = options.now == null ? Date.now() : (typeof options.now === 'number' ? options.now : Date.parse(options.now));
  let syncResult = null;
  try {
    syncResult = syncUsage({ root: dirs.root, chatId, now });
  } catch (error) {
    syncResult = { ok: false, error: error.message };
  }
  const statePath = path.join(dirs.chatState, `${chatId}.json`);
  const state = readJson(statePath) || { chatId, title: null, reviewedThroughAt: null, note: null };
  if (options.title) state.title = shortText(options.title, 80);
  if (options.note) state.note = shortText(options.note, 120);
  state.chatId = chatId;
  state.reviewedThroughAt = nowIso(now);
  state.updatedAt = nowIso(now);
  writeJsonAtomic(statePath, state);
  rebuild(dirs, { now });
  return { chatId, statePath, chatPath: path.join(dirs.chats, `${chatId}.md`), reviewedThroughAt: state.reviewedThroughAt, sync: syncResult };
}

module.exports = {
  DEFAULT_SETTINGS,
  OUTCOMES,
  SCHEMA_VERSION,
  layout,
  getChatId,
  sanitizeId,
  ensureCatalog,
  parseModelCatalog,
  parseCodexUsage,
  computeCodexDeltas,
  parseOpenCodeTranscript,
  buildRequestEfficiency,
  recordOpenCodeRun,
  syncUsage,
  recordExternalRun,
  reviewRun,
  finishChat,
  computeEstimate,
  rebuild,
  loadSettings
};

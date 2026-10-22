const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REDACTION_NOTE = 'Redaction is pattern-based (Authorization/Bearer headers, common api key/token/secret/password assignments, sk-style keys, JWTs). It cannot guarantee removal of unknown or encoded credential formats; only a bounded sanitized tail is stored, raw stderr is never persisted.';

const DEFAULT_STEPS = { explore: 12, worker: 40 };
const STEPS_MIN = 1;
const STEPS_MAX = 200;
const DEFAULT_TIMEOUT_MS = 1200000;
const DEFAULT_STARTUP_TIMEOUT_MS = 180000;
const DEFAULT_COOLDOWN_MS = 60000;
const TIMEOUT_MIN_MS = 100;
const TIMEOUT_MAX_MS = 7200000;
const COOLDOWN_MIN_MS = 100;
const COOLDOWN_MAX_MS = 86400000;
const MAX_STDERR_RAW_BYTES = 262144;
const MAX_STDERR_TAIL_CHARS = 4000;

function parseBoundedInt(value, { min, max, name }) {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (received ${value})`);
  }
  return parsed;
}

function resolveSteps(agent, value) {
  if (value == null) {
    const fallback = DEFAULT_STEPS[agent];
    if (fallback == null) throw new Error(`Unknown agent: ${agent}`);
    return fallback;
  }
  return parseBoundedInt(value, { min: STEPS_MIN, max: STEPS_MAX, name: '--steps' });
}

function resolveTimeoutMs(value) {
  if (value == null) return DEFAULT_TIMEOUT_MS;
  return parseBoundedInt(value, { min: TIMEOUT_MIN_MS, max: TIMEOUT_MAX_MS, name: '--timeout-ms' });
}

function resolveStartupTimeoutMs(value) {
  if (value == null) return DEFAULT_STARTUP_TIMEOUT_MS;
  return parseBoundedInt(value, { min: TIMEOUT_MIN_MS, max: TIMEOUT_MAX_MS, name: '--startup-timeout-ms' });
}

function resolveCooldownMs(value) {
  if (value == null) return DEFAULT_COOLDOWN_MS;
  return parseBoundedInt(value, { min: COOLDOWN_MIN_MS, max: COOLDOWN_MAX_MS, name: '--cooldown-ms' });
}

function mergeConfigContent(existingText, { agent, steps, browser }) {
  let base = {};
  if (existingText != null && String(existingText).trim() !== '') {
    try {
      base = JSON.parse(String(existingText).replace(/^﻿/, ''));
    } catch (error) {
      throw new Error(`OPENCODE_CONFIG_CONTENT is not valid JSON (${error.message}); refusing to overwrite unknown overrides`);
    }
    if (!base || typeof base !== 'object' || Array.isArray(base)) throw new Error('OPENCODE_CONFIG_CONTENT must be a JSON object');
  }
  const merged = JSON.parse(JSON.stringify(base));
  merged.agent = merged.agent && typeof merged.agent === 'object' ? merged.agent : {};
  merged.agent[agent] = { ...(merged.agent[agent] && typeof merged.agent[agent] === 'object' ? merged.agent[agent] : {}), steps };
  if (browser === true && agent === 'worker') {
    merged.agent.worker = { ...merged.agent.worker, tools: { ...(merged.agent.worker?.tools && typeof merged.agent.worker.tools === 'object' ? merged.agent.worker.tools : {}), 'chrome-devtools*': true } };
  }
  return JSON.stringify(merged);
}

const REDACTIONS = [
  [/\b(authorization|proxy-authorization|cookie|set-cookie)["']?\s*[:=]\s*[^\r\n]+/gi, '$1: [REDACTED]'],
  [/\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [REDACTED]'],
  [/\b(x-api-key|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|session[-_]?token|auth[-_]?token|csrf[-_]?token|token|secret|password|passwd|client[-_]?secret)["']?\s*[:=]\s*["']?[^\s"',;]+/gi, '$1=[REDACTED]'],
  [/\b(sk|pk|rk|gh[pousr])[-_][A-Za-z0-9_-]{16,}/g, '[REDACTED-KEY]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, '[REDACTED-JWT]']
];

function sanitizeStderr(text, max = MAX_STDERR_TAIL_CHARS) {
  let value = typeof text === 'string' ? text : '';
  for (const [pattern, replacement] of REDACTIONS) value = value.replace(pattern, replacement);
  if (value.length > max) value = value.slice(value.length - max);
  return value;
}

function detectFailureSignals(text) {
  const value = typeof text === 'string' ? text : '';
  let httpStatus = null;
  const statusMatch = /(?:http(?:\/[\d.]+)?\s+|status(?:Code)?["']?\s*[:=]?\s*)([45]\d{2})\b/i.exec(value);
  if (statusMatch) httpStatus = Number(statusMatch[1]);
  let retryAfterRaw = null;
  const retryMatch = /retry-after["']?\s*[:=]\s*(?:["']([^"'\r\n]+)["']|([^\r\n;]+))/i.exec(value);
  if (retryMatch) retryAfterRaw = (retryMatch[1] || retryMatch[2]).trim();
  try {
    const parsed = JSON.parse(value);
    const visit = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 6) return;
      const status = Number(node.statusCode ?? node.status);
      if (Number.isInteger(status) && status >= 400 && status <= 599) httpStatus = status;
      for (const [key, entry] of Object.entries(node)) {
        if (key.toLowerCase() === 'retry-after' && ['string', 'number'].includes(typeof entry)) retryAfterRaw = String(entry);
        if (entry && typeof entry === 'object') visit(entry, depth + 1);
      }
    };
    visit(parsed);
  } catch {}
  const freeQuota = /FreeUsageLimitError|free\s+usage\s+limit|usage\s+limit\s+exceeded|quota\s+exceeded/i.test(value);
  return { httpStatus, retryAfterRaw, freeQuota };
}

function classifyFailure({ text, httpStatus, freeQuota } = {}) {
  const value = typeof text === 'string' ? text : '';
  const signals = freeQuota == null ? detectFailureSignals(value) : { freeQuota, httpStatus: httpStatus ?? detectFailureSignals(value).httpStatus };
  const status = httpStatus ?? signals.httpStatus;
  if (signals.freeQuota || /quota/i.test(value)) return 'quota';
  if (status === 429 || /rate[-\s]?limit|too\s+many\s+requests/i.test(value)) return 'rate';
  if (status === 401 || status === 403 || /unauthorized|forbidden|permission\s+denied|access\s+denied/i.test(value)) return 'permission';
  if (/timed?\s?out|timeout|ETIMEDOUT/i.test(value)) return 'timeout';
  return 'unknown';
}

function parseRetryAfter(value, now = Date.now()) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const result = now + Number(text) * 1000;
    return Number.isFinite(result) && result <= 8640000000000000 ? Math.ceil(result) : null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function cooldownDir(root) {
  return path.join(path.resolve(root), 'usage', 'data', 'cooldowns');
}

function cooldownPath(root, model) {
  const hash = crypto.createHash('sha256').update(String(model)).digest('hex');
  return path.join(cooldownDir(root), `${hash}.json`);
}

function readCooldown({ root, model, now = Date.now() }) {
  const file = cooldownPath(root, model);
  let state = null;
  try {
    if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    state = null;
  }
  if (!state || typeof state !== 'object') return { blocked: false, retryAt: null, reason: null, source: null, attempts: 0 };
  const retryAt = typeof state.retryAt === 'number' ? state.retryAt : null;
  return {
    blocked: retryAt != null && now < retryAt,
    retryAt,
    reason: state.reason || null,
    source: state.source || null,
    attempts: Number.isFinite(state.attempts) ? state.attempts : 0
  };
}

function writeCooldownState(root, model, next) {
  const file = cooldownPath(root, model);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function recordCooldown({ root, model, retryAt, reason, source, now = Date.now() }) {
  const current = readCooldown({ root, model, now: 0 });
  const preserve = current.retryAt != null && current.retryAt > retryAt;
  const next = {
    model,
    retryAt: preserve ? current.retryAt : retryAt,
    reason: preserve ? current.reason : reason || null,
    source: preserve ? current.source : source || null,
    updatedAt: new Date(now).toISOString(),
    attempts: current.attempts,
    lastBlockedAt: current.retryAt != null ? new Date(current.retryAt).toISOString() : null
  };
  writeCooldownState(root, model, next);
  return next;
}

function recordBlockedAttempt({ root, model, now = Date.now() }) {
  const current = readCooldown({ root, model, now });
  const next = {
    model,
    retryAt: current.retryAt,
    reason: current.reason,
    source: current.source,
    updatedAt: new Date(now).toISOString(),
    attempts: current.attempts + 1,
    lastBlockedAt: new Date(now).toISOString()
  };
  writeCooldownState(root, model, next);
  return next;
}

function stableEventKey(event) {
  if (event?.part?.id != null && event.part.id !== '') return String(event.part.id);
  return crypto.createHash('sha1').update(JSON.stringify(event)).digest('hex');
}

function createStepTracker() {
  const seen = new Set();
  return {
    feed(line) {
      let event;
      try {
        event = JSON.parse(line);
      } catch (error) {
        return false;
      }
      if (event && (event.type === 'step_finish' || event.type === 'step-finish')) {
        seen.add(stableEventKey(event));
        return true;
      }
      return Boolean(event && (event.type === 'text' || event.type === 'sessionID' || event.sessionID));
    },
    get completedSteps() {
      return seen.size;
    }
  };
}

function runGuardedProcess({ spawnFn, file, args, cwd, env, timeoutMs, startupTimeoutMs, onLine, onRawStdout }) {
  return new Promise((resolve) => {
    const child = spawnFn(file, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    const stderrChunks = [];
    let stderrBytes = 0;
    let pending = '';
    let startupDone = false;
    let settled = false;
    let terminationReason = null;
    let spawnError = null;
    const totalTimer = setTimeout(() => {
      terminationReason = 'timeout';
      try { child.kill(); } catch {}
    }, timeoutMs);
    const startupTimer = setTimeout(() => {
      terminationReason = 'startup-timeout';
      try { child.kill(); } catch {}
    }, startupTimeoutMs);
    const consume = (text) => {
      pending += text;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        if (line.trim() === '') continue;
        const cleared = onLine ? onLine(line) : false;
        if (!startupDone && cleared) {
          startupDone = true;
          clearTimeout(startupTimer);
        }
      }
    };
    child.stdout.on('data', (chunk) => {
      if (onRawStdout) onRawStdout(chunk);
      consume(chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
      while (stderrBytes > MAX_STDERR_RAW_BYTES) {
        const excess = stderrBytes - MAX_STDERR_RAW_BYTES;
        if (stderrChunks[0].length <= excess) stderrBytes -= stderrChunks.shift().length;
        else { stderrChunks[0] = stderrChunks[0].subarray(excess); stderrBytes -= excess; }
      }
    });
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      clearTimeout(startupTimer);
      if (pending.trim() !== '') {
        const cleared = onLine ? onLine(pending) : false;
        if (!startupDone && cleared) startupDone = true;
      }
      resolve({
        exitCode: code,
        terminationReason: spawnError ? 'spawn-error' : terminationReason,
        spawnError,
        startupCleared: startupDone,
        stderrTail: Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))).toString()
      });
    });
  });
}

module.exports = {
  REDACTION_NOTE,
  DEFAULT_STEPS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_COOLDOWN_MS,
  parseBoundedInt,
  resolveSteps,
  resolveTimeoutMs,
  resolveStartupTimeoutMs,
  resolveCooldownMs,
  mergeConfigContent,
  sanitizeStderr,
  detectFailureSignals,
  classifyFailure,
  parseRetryAfter,
  cooldownPath,
  readCooldown,
  recordCooldown,
  recordBlockedAttempt,
  stableEventKey,
  createStepTracker,
  runGuardedProcess
};

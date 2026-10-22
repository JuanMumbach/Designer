const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./usage-ledger.cjs');

function inside(directory, base) {
  const relative = path.relative(base, path.resolve(directory));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function handleHook(event, options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const api = path.resolve(root, '../DesignerAPI');
  if (!event.cwd || ![root, api].some((base) => inside(event.cwd, base))) return null;
  const chatId = event.session_id || ledger.getChatId();
  if (!chatId || !ledger.sanitizeId(chatId)) throw new Error('Usage hook received an invalid or missing chat ID.');
  const collector = options.collector || ledger;
  if (event.hook_event_name === 'SessionStart') {
    collector.syncUsage({ root, chatId });
    const summaryPath = path.join(root, 'usage/optimization.json');
    const context = `Designer orchestration: for each new repository task, including resumed chats and after compaction, delegate substantial planning and implementation to OpenCode before source exploration or edits. Prefer Big Pickle for planning and implementation; Codex coordinates and reviews. Respect launcher step budgets and quota cooldowns. Review ${summaryPath} before routing work. Log this chat with ID ${chatId}; review new delegated runs and finish the usage report before the final reply. Existing-context conversation needs no ceremonial model call.`;
    return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
  }
  if (event.hook_event_name === 'Stop') collector.finishChat({ root, chatId });
  return null;
}

if (require.main === module) {
  try {
    const input = fs.readFileSync(0, 'utf8');
    if (input.length > 1024 * 1024) throw new Error('Usage hook input exceeds its metadata limit.');
    const result = handleHook(JSON.parse(input));
    if (result) process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stdout.write(JSON.stringify({ systemMessage: `Designer usage log was not updated: ${error.message}` }));
    process.exitCode = 0;
  }
}

module.exports = { handleHook };

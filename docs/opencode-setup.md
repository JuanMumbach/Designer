# OpenCode for Designer and DesignerAPI

Usage reports, quality reviews, savings estimates, model-catalog checks and lifecycle-hook setup are documented in [model-usage.md](./model-usage.md).

Codex-specific orchestration instructions live in each repository's `.codex/config.toml` and `.codex/orchestration.md`. A self-contained routing block is also installed in Codex's user instruction file (`~/.codex/AGENTS.md`, or the existing non-empty `AGENTS.override.md`). That block applies only to Designer and DesignerAPI and survives overrides of the project `developer_instructions` setting. Shared project instructions do not assign orchestration duties to OpenCode. OpenCode loads its agents and MCP servers from each repository's `opencode.json`.

Install or repair only the Codex routing instructions with `python scripts/install-codex-orchestration.py`. This preserves unrelated user guidance and unrelated TOML settings; it refuses to replace unmanaged developer instructions. The full setup script invokes this installer too.

The original setup verified manual worker execution but did not verify automatic instruction delivery in Codex chats. The routing repair embeds the full policy instead of only a file pointer, adds scoped auto-discovered Codex guidance, and requires session evidence in repository task reports. Local prompt rendering from App and API confirmed the routing block remains present when project developer instructions are overridden to empty. The current chat also received the new global block in its model-visible instructions. The installer preserves custom guidance outside managed markers and reconciles existing managed blocks in both global instruction files.

## Installed tools

This setup uses Yarn Classic user-level packages:

```powershell
yarn.cmd global add opencode-ai @modelcontextprotocol/server-memory chrome-devtools-mcp
```

The launcher resolves the installed CLI through `.opencode/runtime.local.json`; it does not depend on the Yarn global bin directory being on PATH. On another machine, install these packages and run `scripts/setup-opencode.ps1` with `-SourceConfig` pointing to a local OpenCode configuration containing Context7, Chrome DevTools, and Memory. The script preserves the Context7 endpoint and headers, puts header values in ignored local files, and configures both sibling repositories. Existing unrelated Codex configuration requires manual merging.

## Run a task

Write the assignment to a UTF-8 text file, then run from Designer:

```powershell
node scripts/run-opencode.cjs --repo app --agent explore --prompt-file .opencode/task.local.txt
node scripts/run-opencode.cjs --repo api --agent worker --prompt-file .opencode/task.local.txt
node scripts/run-opencode.cjs --repo app --agent explore --steps 24 --timeout-ms 1200000 --prompt-file .opencode/plan.local.txt
```

Use `--session <session ID>` for a follow-up to the same task. Add `--browser true` to a worker invocation when browser tools are needed. The launcher prints the session ID, tool outcomes, and final response; raw JSON events are saved in ignored `.opencode/runs/` files. Each run also writes a `.receipt.json` file with status, repository, model, agent, session, tool count, and transcript path. Completed status requires a zero process exit, a session ID, and an actual assistant response without a model error. It confirms inference occurred, not that the worker's task was correct; review the response and validation evidence. Task files, credentials, and runtime metadata named `*.local.*` under `.opencode/` are ignored by Git.

For repository work, Codex must delegate a relevant assignment before substantial exploration or edits and include the session/transcript or receipt in its final report. A blocked run requires an explicit explanation before direct takeover. Native Codex subagents, configuration changes, or old transcripts are not evidence of a new OpenCode assignment. Conversational answers using existing context need no artificial run.

Big Pickle is the default for both read-only planning/exploration and implementation. The explorer denies edits, shell commands, recursive delegation, and memory mutations. The worker can edit and run commands within the parent task's authorized scope. MiMo V2.6 Flash Free remains available through `--model opencode/mimo-v2.6-flash-free` for targeted lookups. Both agents support direct CLI invocation and invocation as OpenCode subagents (`mode: all`). The launcher allows only verified free models; check current zero pricing before using them and before adding alternatives.

For each new repository task, including a new assignment in a resumed chat, delegate substantial planning and implementation to OpenCode. Codex clarifies scope, assigns ownership, reviews evidence, and makes small integration corrections. Do not substitute a ceremonial discovery call for delegating the actual work. Keep useful related work together, batch independent reads and checks, and continue related work in the same explicit session when appropriate. Failures require a concrete diagnosis before substantial direct takeover.

The launcher accepts adjustable `--steps`, `--timeout-ms`, and `--startup-timeout-ms` budgets. Exploration defaults to 12 steps and implementation to 40; grant substantial planning a larger budget when justified. Reaching a step budget forces a summary, not task acceptance. Review partial results and continue deliberately without skipping validation. See [model-usage.md](./model-usage.md) for observed request counts and diagnostic limitations.

## MCP behavior

- Context7 provides library documentation to both agents.
- Memory is shared between App and API at the App's `.agents/context-memory/memory.jsonl`. It is separate from Synapsis memory. Explorers can read/search; workers can update it.
- Chrome DevTools runs a separate isolated headless Chrome instance, with usage statistics disabled. Browser tools are hidden by default and enabled by `--browser true`. This avoids requiring remote debugging in personal Chrome. It does not reuse personal browser logins.

MCP connection status confirms startup and tool discovery, not a successful browser operation. Verify actual tool calls after changing configuration. Launch OpenCode from the repository being checked before running `opencode mcp list`.

## Permissions and validation

OpenCode writes logs and session data to the user profile and contacts model/MCP services. Codex must obtain the required sandbox approval before running it. Adding or trusting the API project does not automatically extend an already-running chat's writable roots; API workers still require approved execution when outside those roots.

App workers read `AGENTS.md`; API workers read `Agent.md`, explicitly included in their OpenCode configuration and launcher prompts. Codex loads project-local configuration only for trusted projects. Newly created Codex sessions should receive the scoped global routing block automatically; confirm it is present in the chat's instruction context. Existing chats may need a restart or an explicit instruction refresh. Instructions guide model behavior; they are not a host-level dispatcher or an enforcement hook.

Configuration checks do not require an App build, API build, or database changes. Validate application changes with the relevant Yarn or .NET checks when those changes are assigned.

## Verification on October 18, 2026

Installed versions: OpenCode CLI 1.19.3, Memory server 1.0.0, Chrome DevTools MCP 1.11.0. The refreshed catalog reported zero input and output cost for both configured models. All three MCP servers connected from each repository.

| Integration check | App | API |
| --- | --- | --- |
| MiMo explorer reads repository instructions and source metadata | Passed | Passed |
| Big Pickle worker writes and reads an ignored test file | Passed | Passed |
| Context7 library lookup from explorer and worker | Passed | Passed |
| Shared Memory access | Workspace entity created and read | Same entity read |
| Chrome DevTools page listing from worker | Passed | Passed |

The initial Chrome auto-connect failed because the personal Chrome profile lacked a DevToolsActivePort file. The final isolated headless configuration passed in both repositories, including a resumed worker session. Temporary worker output files were removed after exact-content checks. Raw run transcripts remain in the ignored run directory. Configuration JSON, Codex TOML, launcher syntax, setup-script syntax, Git credential exclusions, and whitespace checks passed. This verifies the configured integration, not a comparative model benchmark or application behavior.

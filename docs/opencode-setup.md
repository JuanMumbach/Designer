# OpenCode for Designer and DesignerAPI

Codex-specific orchestration instructions live in each repository's `.codex/config.toml` and `.codex/orchestration.md`. Shared project instructions do not assign orchestration duties to OpenCode. OpenCode loads its agents and MCP servers from each repository's `opencode.json`.

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
```

Use `--session <session ID>` for a follow-up to the same task. Add `--browser true` to a worker invocation when browser tools are needed. The launcher prints the session ID, tool outcomes, and final response; raw JSON events are saved in ignored `.opencode/runs/` files. Task files, credentials, and runtime metadata named `*.local.*` under `.opencode/` are ignored by Git.

The explorer uses MiMo V2.6 Flash Free with edits, shell commands, recursive delegation, and memory mutations denied. The worker uses Big Pickle and can edit and run commands within the parent task's authorized scope. Both agents support direct CLI invocation and invocation as OpenCode subagents (`mode: all`). The launcher's initial model allowlist contains these two IDs; check current zero pricing before using them and before adding alternatives.

## MCP behavior

- Context7 provides library documentation to both agents.
- Memory is shared between App and API at the App's `.agents/context-memory/memory.jsonl`. It is separate from Synapsis memory. Explorers can read/search; workers can update it.
- Chrome DevTools runs a separate isolated headless Chrome instance, with usage statistics disabled. Browser tools are hidden by default and enabled by `--browser true`. This avoids requiring remote debugging in personal Chrome. It does not reuse personal browser logins.

MCP connection status confirms startup and tool discovery, not a successful browser operation. Verify actual tool calls after changing configuration. Launch OpenCode from the repository being checked before running `opencode mcp list`.

## Permissions and validation

OpenCode writes logs and session data to the user profile and contacts model/MCP services. Codex must obtain the required sandbox approval before running it. Adding or trusting the API project does not automatically extend an already-running chat's writable roots; API workers still require approved execution when outside those roots.

App workers read `AGENTS.md`; API workers read `Agent.md`, explicitly included in their OpenCode configuration and launcher prompts. Codex loads project-local configuration only for trusted projects. Start a new Codex chat to ensure newly added project configuration is loaded. The policy can also be read explicitly during an existing chat.

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

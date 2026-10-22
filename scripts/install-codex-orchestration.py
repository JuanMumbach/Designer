import argparse
import json
import os
import pathlib
import re
import tomllib


parser = argparse.ArgumentParser()
parser.add_argument("--codex-home", default=os.environ.get("CODEX_HOME", str(pathlib.Path.home() / ".codex")))
options = parser.parse_args()
app_root = pathlib.Path(__file__).resolve().parent.parent
api_root = app_root.parent / "DesignerAPI"
codex_home = pathlib.Path(options.codex_home).expanduser()
launcher = (app_root / "scripts/run-opencode.cjs").as_posix()
usage_cli = (app_root / "scripts/usage.cjs").as_posix()
optimization_path = (app_root / "usage/optimization.json").as_posix()
policy = f"""# OpenCode routing policy v4

These instructions apply to Codex for Designer and DesignerAPI. Codex primarily orchestrates, clarifies requirements, assigns ownership, and reviews evidence. OpenCode performs the substantial planning, architecture proposals, exploration, implementation, debugging, tests, and documentation. Prefer Big Pickle for both planning and implementation. Delegate useful end-to-end units rather than performing most work directly after a token discovery call. Codex may make small integration corrections during review; delegate substantial follow-on work again. Apply this routing anew for each new task in a resumed chat and after compaction; a previous task's run does not satisfy the current task.

At the first repository task in each chat, obtain CODEX_THREAD_ID (or CODEX_SESSION_ID) from the environment, run node "{usage_cli}" sync --chat <that ID>, and read {optimization_path}. Never guess a chat ID or attribute another chat's runs to this one. The usage folder is private and ignored by Git. At task completion, review each new usage run with the usage CLI, recording accepted/reworked/rejected plus actual validation evidence, repairs and defects. A completed receipt proves inference, not correctness. Run node "{usage_cli}" finish --chat <that ID> with a short title and a short result/procedure note before the final reply; ordinary conversational turns may simply sync existing usage without artificial worker calls.

Use the optimization summary to adjust task size, tool context, repair limits, and model experiments. Prefer validated quality, then lower GPT review/repair effort and latency. Recommendations are proposals, not permission to select paid models or silently change defaults. Require comparable reviewed evidence before broad routing changes, preserve failed/reworked history, and never add calls just to inflate estimated savings. Report meaningful new procedure suggestions after a task; do not invent a change when evidence is insufficient. Model catalogs are refreshed by the launcher once per chat and after 24 hours; added/removed models, pricing and capability changes are recorded. Confirm inference and quality before adopting a new free candidate.

Keep measured GPT/OpenCode tokens separate from hypothetical GPT savings. Estimates are uncalibrated ranges after quality discounts and GPT overhead, can be negative, and imply no exact billing or subscription quota reduction. Record other-model calls explicitly through usage record when they are outside the launcher. Historical runs without a known parent chat remain unattributed. Lifecycle logging hooks require one-time user trust in Codex; do not bypass that review or claim the hooks are active without host evidence.

For every repository analysis or implementation task, launch at least one task-relevant OpenCode assignment before substantial source exploration or edits. Initial instruction/configuration discovery, routing, and diff review may be performed directly. Do not classify ordinary coding tasks as tiny to avoid delegation. Direct answers based entirely on existing conversation context do not require an artificial worker run.

Announce the assignment and invoke node "{launcher}" --repo app|api --agent explore|worker --prompt-file <absolute UTF-8 task-file path>. Create the bounded task file under the App's ignored .opencode directory. Run the command, wait for completion, inspect its evidence, and review the result. A plan, a configuration file, or native GPT/Codex subagents do not count as OpenCode usage. Use one writer per repository. Give file ownership, acceptance criteria, allowed commands, and constraints in each assignment. Preserve existing user changes.

Use Big Pickle for read-only planning through --agent explore --model opencode/big-pickle, and implementation through --agent worker. MiMo V2.6 Flash Free remains an optional choice for simple targeted lookups and auxiliary work. Check current zero input/output pricing before first use in a session. Never silently select paid models. Use --session <explicit ID> for related follow-ons and repairs, preserving useful context. Allow one focused repair attempt; if unsuccessful, report the blocker and narrow or reassign the task before a substantial direct takeover. Add --browser true only for browser work. Workers execute directly without recursive delegation.

Optimize validated results per observed model step, not launcher invocation counts or raw token volume. Batch independent relevant reads and validation commands; include known paths and contracts in assignments. Avoid repeated full-repository rediscovery, unnecessary documentation/MCP lookups, tiny ceremonial tasks, and oversized assignments that cause repairs. Use the launcher's adjustable --steps, --timeout-ms and --startup-timeout-ms budgets. Defaults are 12 exploration steps and 40 implementation steps; for substantial Big Pickle planning explicitly allow a suitable budget. A budget-ending summary is partial work to review and continue, not proof of completion. Increase budgets for justified work rather than dropping validation. Respect persisted model cooldowns and Retry-After; do not blindly retry or switch models to evade limits. Distinguish quota errors, transient service failures, permission errors, and unknown startup stalls. Record observed daily generation steps as a lower bound; never claim exact quota remaining. Native retries and background/title calls may not appear in transcripts.

If OpenCode fails or an approval is needed, report the concrete blocker before taking over. Request required sandbox approval through the execution tool; never use delegation to bypass restrictions. A service failure, unavailable tool, user instruction to work directly, or higher-priority restriction can justify direct work, but must be stated in the final response. There is no silent fallback.

End repository task reports with OpenCode evidence: agent/model, session ID, and transcript or receipt path. If no run completed, explicitly say OpenCode was not used and why. Never reuse an old run as evidence for a new task. Raw transcripts and receipts are under {app_root.as_posix()}/.opencode/runs/.

App workers read AGENTS.md and use Yarn Classic. API workers read Agent.md and use .NET commands. Do not apply database migrations without task authorization. Assign validation appropriate to the change and inspect the diff and relevant results independently. Return concise findings or changed files, commands with outcomes, uncertainties, and blockers, preferably within 400 words. Keep large source dumps and full transcripts out of GPT context.

Context7 provides dependency documentation. Memory is shared between App/API and separate from Synapsis. Explorers cannot edit files or memory. Browser tools use isolated headless Chrome and are opt-in. Store no credentials or private request payloads in memory. Keep Codex routing instructions out of shared AGENTS.md and OpenCode worker prompts.
"""
begin = "<!-- BEGIN DESIGNER OPENCODE ROUTING -->"
end = "<!-- END DESIGNER OPENCODE ROUTING -->"
block = f"""{begin}
## Designer OpenCode routing

Apply this section only when the working directory is inside {app_root.as_posix()} or {api_root.as_posix()}, or the user explicitly assigns work on those repositories. It has no effect on other projects.

For repository analysis and implementation, Codex acts as orchestrator. Before substantial source exploration or edits, delegate a task-relevant assignment to OpenCode using node "{launcher}" --repo app|api --agent explore|worker --prompt-file <absolute task-file path>. Write bounded task files under {app_root.as_posix()}/.opencode/ with a .local.txt suffix. Actually execute the command and review the completed run; configuration, plans, and GPT/Codex subagents are not evidence of OpenCode use. Initial instruction/configuration discovery, routing, and final review can be done directly. Ordinary coding tasks must not be silently treated as exempt.

Reapply delegation for every new task in a resumed chat and after compaction. OpenCode should do most planning, implementation, debugging, tests and documentation; Codex coordinates and reviews. Prefer Big Pickle for planning (--agent explore --model opencode/big-pickle) and implementation (--agent worker). A ceremonial discovery call is insufficient when substantial implementation can be delegated. Batch related work, use adjustable step budgets, retain quality checks, and respect persisted quota cooldowns. Count observed model steps separately from assignments; more calls are not an optimization goal.

Announce delegation. Use the free model defaults, one writer per repository, concise worker reports, and relevant validation. Obtain required execution approval; do not bypass sandbox limits. If OpenCode fails or cannot be used, report the blocker before direct takeover and explain the exception in the final answer. End repository task reports with the OpenCode agent/model, session ID, and transcript or receipt path, or explicitly state that OpenCode was not used and why. Do not cite stale runs as evidence for a new task.

Read the repository's .codex/orchestration.md for the full policy. These are Codex-specific instructions; do not copy them into shared project instructions or OpenCode prompts.

Usage tracking: at the start of repository work, read {optimization_path} and run node "{usage_cli}" sync --chat <CODEX_THREAD_ID or CODEX_SESSION_ID from the environment>. The launcher records model usage automatically. Before the final reply, record quality reviews for new runs and run usage finish for this chat with a short result/procedure note. Use the summary to improve bounded task assignments and quality, not to maximize call counts. Distinguish measured usage from uncalibrated savings ranges; flag model-catalog changes and suggest evidence-backed procedure changes. Lifecycle hooks refresh logs after user trust; never bypass hook review.
{end}
"""

updates = []
project_begin = "<!-- BEGIN DESIGNER OPENCODE PROJECT POLICY -->"
project_end = "<!-- END DESIGNER OPENCODE PROJECT POLICY -->"
project_block = project_begin + "\n" + policy + project_end


def replace_project_policy(current, legacy, label):
    if project_begin in current or project_end in current:
        if current.count(project_begin) != 1 or current.count(project_end) != 1:
            raise SystemExit(f"Incomplete or duplicate managed policy: {label}")
        updated, count = re.subn(
            re.escape(project_begin) + r"[\s\S]*?" + re.escape(project_end),
            lambda _: project_block,
            current,
            count=1,
        )
        if count != 1:
            raise SystemExit(f"Invalid managed policy boundaries: {label}")
        return updated
    if not current.strip():
        return project_block + "\n"
    for known in legacy:
        if known in current:
            if current.count(known) != 1:
                raise SystemExit(f"Duplicate legacy policy: {label}")
            return current.replace(known, project_block, 1)
    raise SystemExit(f"Unmanaged instructions require manual merging: {label}")


for repository in (app_root, api_root):
    if not repository.is_dir():
        raise SystemExit(f"Missing repository: {repository}")
    config_path = repository / ".codex/config.toml"
    existing = config_path.read_text(encoding="utf-8-sig") if config_path.exists() else ""
    parsed = tomllib.loads(existing)
    current = parsed.get("developer_instructions", "")
    old_pointer = f"Read {(repository / '.codex/orchestration.md').as_posix()} and follow its OpenCode orchestration policy. The launcher is {launcher}. These instructions apply to Codex only."
    replacement = replace_project_policy(current, (policy.strip(), old_pointer), config_path)
    setting = "developer_instructions = '''\n" + replacement + "'''"
    if current:
        updated, count = re.subn(
            r"(?m)^developer_instructions\s*=\s*'''[\s\S]*?'''",
            lambda _: setting,
            existing,
            count=1,
        )
        if count != 1:
            raise SystemExit(f"Unsupported developer instruction format: {config_path}")
    else:
        updated = setting + "\n" + existing
    tomllib.loads(updated)
    updates.append((config_path, updated))
    policy_path = repository / ".codex/orchestration.md"
    existing_policy = policy_path.read_text(encoding="utf-8-sig") if policy_path.exists() else ""
    updated_policy = replace_project_policy(existing_policy, (policy.strip(),), policy_path)
    updates.append((policy_path, updated_policy))

override = codex_home / "AGENTS.override.md"
global_path = override if override.exists() and override.read_text(encoding="utf-8-sig").strip() else codex_home / "AGENTS.md"
for candidate in (codex_home / "AGENTS.md", override):
    existing_global = candidate.read_text(encoding="utf-8-sig") if candidate.exists() else ""
    if candidate != global_path and begin not in existing_global and end not in existing_global:
        continue
    if begin in existing_global or end in existing_global:
        if existing_global.count(begin) != 1 or existing_global.count(end) != 1:
            raise SystemExit(f"Incomplete or duplicate managed instruction block: {candidate}")
        updated_global, count = re.subn(re.escape(begin) + r"[\s\S]*?" + re.escape(end), lambda _: block.rstrip(), existing_global, count=1)
        if count != 1:
            raise SystemExit(f"Invalid managed instruction boundaries: {candidate}")
    else:
        updated_global = existing_global.rstrip() + ("\n\n" if existing_global.strip() else "") + block
    updates.append((candidate, updated_global))
hook_script = app_root / "scripts/usage-hook.cjs"
if hook_script.exists():
    hook_path = codex_home / "hooks.json"
    hooks_config = json.loads(hook_path.read_text(encoding="utf-8-sig")) if hook_path.exists() else {"hooks": {}}
    if not isinstance(hooks_config.get("hooks", {}), dict):
        raise SystemExit(f"Unsupported hooks configuration: {hook_path}")
    hooks_config.setdefault("hooks", {})
    command = f'node "{hook_script.as_posix()}"'
    for event_name in ("SessionStart", "Stop"):
        groups = hooks_config["hooks"].setdefault(event_name, [])
        if not isinstance(groups, list):
            raise SystemExit(f"Unsupported {event_name} hooks: {hook_path}")
        if not any(handler.get("command") == command for group in groups for handler in group.get("hooks", [])):
            groups.append({"hooks": [{"type": "command", "command": command, "timeout": 15, "statusMessage": "Updating Designer usage log"}]})
    updates.append((hook_path, json.dumps(hooks_config, indent=2) + "\n"))
for target, content in updates:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
print(f"Installed self-contained Codex routing instructions in both project configs and {global_path}.")
print("Global routing is scoped to Designer and DesignerAPI; existing unrelated instructions were preserved.")
if hook_script.exists():
    print("Usage lifecycle hooks are configured. Codex requires review/trust of new hook definitions through /hooks before running them; trust settings were not changed.")

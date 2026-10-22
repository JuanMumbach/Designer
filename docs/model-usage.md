# Chat usage and optimization

The App repository keeps the shared logs for Designer and DesignerAPI:

- `usage/chats/<Codex chat ID>.md`: one short report per chat, updated in place.
- `usage/summary.md`: a compact index across recorded chats.
- `usage/optimization.json`: functional model/task observations, estimation assumptions, catalog changes, review notes, and proposed procedure changes for Codex.
- `usage/settings.json`: editable assumptions and evidence thresholds. Extra fields are preserved; invalid numeric settings are rejected.
- `usage/data/`: measured counters, per-run records, review history, and safe catalog snapshots.

The entire folder is local and ignored by Git. Generated reports contain no copied prompts, chat bodies, source files, or credentials. Existing raw OpenCode transcripts remain in the separate ignored `.opencode/runs/` folder and are linked through the per-run data records. Chat reports use Buenos Aires time; machine snapshots use UTC. Large counters are abbreviated in human reports, with exact numbers retained in the data files. Reports summarize recorded calls and do not claim that untracked historical calls never occurred.

## Automatic collection

`run-opencode.cjs` associates calls with `CODEX_THREAD_ID` or `CODEX_SESSION_ID`. Use `--chat <id>` when calling from another shell; otherwise the run remains unattributed. Optional `--task "short label" --kind implementation` records useful task metadata without copying the prompt. The launcher returns a bounded final report and stores full evidence separately.

It checks the official model catalog for each chat and at least every 24 hours. Known zero input/output pricing and tool support are required before the selected model runs; pricing, availability and capability changes are recorded. Catalog history is retained. New candidates produce suggestions, not silent model/configuration changes. Catalog inclusion alone does not prove account access or quality.

Codex instructions now require reading the optimization summary when starting repository work and reviewing/finalizing usage before replying. Local `SessionStart` and `Stop` hooks also synchronize logs without model inference or network calls. **Codex requires one-time review and trust of new hook definitions (`/hooks` in the CLI); installing the file does not grant trust.** Until trusted, launcher collection and the explicit commands below work. Hook errors warn without blocking a reply. [Official hook trust documentation](https://learn.chatgpt.com/docs/hooks).

## Review and finish a chat

Run from Designer, or use the absolute script path from DesignerAPI:

```powershell
node scripts/usage.cjs sync --all true
node scripts/usage.cjs review --run <usage-run-id> --outcome accepted --validation "26 regression tests passed" --repairs 0 --defects 0
node scripts/usage.cjs finish --chat <Codex-chat-id> --title "Short chat title" --note "Result and one useful procedure adjustment."
```

Review outcomes are `accepted`, `reworked`, `rejected`, `unreviewed`, and `not-applicable`. Record actual validation and parent review, not just the worker's success claim. Later acceptance preserves previous rework/rejection history. Use `--gpt-overhead <tokens>` on a review to override the default overhead estimate when you have a better attribution. The CLI prints the usage run ID; receipt files also link to its data record and chat report.

`sync --all true` backfills measured counters from available local Codex sessions belonging to either repository. Older OpenCode receipts without chat attribution are not guessed into a chat. Measured usage is a snapshot **so far**; the final response may not yet have been flushed to the source log. Archived, unavailable, unsupported, and auxiliary-model telemetry may be missing. Raw Codex transcript formats can change; coverage/unknown fields must be respected.

## What the numbers mean

Codex reports cumulative usage: the collector computes global deltas across model switches and recomputes snapshots on sync. Repeated syncs do not add history again. Cached input is part of input, and reasoning is part of output, so neither is added a second time. A source counter reset is flagged as incomplete coverage.

OpenCode reports usage per model step. The collector sums distinct step-finish records, preserving cache and reasoning components; missing fields stay unknown/partial. It does not equate large cached context totals with GPT work avoided. Background title/compaction calls may not be exposed by this stream.

### Request efficiency

Assignments, completed model generation steps, tool operations, and tokens are different measures. One assignment can require many model requests. Daily observed steps are grouped by UTC date and model, with quality outcomes retained alongside them. They are a lower bound on traffic, not an exact provider quota counter: retries, background generation, desktop sessions, other devices, and calls outside this launcher may be missing. Never derive exact quota remaining or assume a fixed daily allowance from these reports.

Use adjustable step budgets to avoid open-ended tool loops. Batch independent relevant reads and checks, provide known paths/contracts, and avoid repeated discovery. Prefer coherent end-to-end assignments over many tiny calls or one oversized assignment. Preserve validation and quality; reduce steps only when results remain correct. A budget-ending summary requires review and a deliberate continuation when work remains.

The defaults are 12 exploration steps, 40 implementation steps, a 3-minute startup timeout and a 20-minute total timeout. Override with `--steps`, `--startup-timeout-ms` and `--timeout-ms`. The step setting asks OpenCode to summarize remaining work; it is not an exact HTTP request cap. Receipts include the selected budget, observed completed steps, budget-reached flag, termination reason, classified error and sanitized stderr tail. Per-model cooldown state is under `usage/data/cooldowns/`; active cooldowns also appear in `optimization.json`. A blocked launch increments its local blocked-attempt count without starting a model process. Missing `Retry-After` defaults to a 60-second local cooldown, adjustable through `--cooldown-ms`.

The launcher applies model cooldowns from explicit quota/rate-limit errors and `Retry-After`, and does not add automatic retries on top of OpenCode's own retry policy. An absent reset header permits only a conservative local cooldown, not an invented provider reset time. Timeouts, permissions, rate limits and unknown failures must remain distinct. An empty transcript does not prove that no request reached the provider.

Failure receipts retain bounded sanitized diagnostics. Redaction is best-effort; do not put secrets in commands, task prompts, or error messages, and inspect diagnostics before sharing. Original model JSONL transcripts can contain source and tool output and remain private in `.opencode/runs/`.

OpenCode's published v1.19.3 [free limiter](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/console/app/src/routes/zen/util/ipRateLimiter.ts) uses a daily request counter with private configured limits and model overrides. Its [handler](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/console/app/src/routes/zen/util/handler.ts) can also route to newer inference services, so this is not a guarantee of current production quota or reset policy. OpenCode documents the supported [agent step budget](https://opencode.ai/docs/agents/#max-steps).

The per-call savings calculation is an **uncalibrated scenario estimate**, not measured GPT savings or a statistical confidence interval:

```text
workload proxy = unique prompt + unique text evidence characters / 4
                 + non-reasoning output tokens
gross range = workload proxy × [0.5, 1.5]
default GPT overhead = task prompt tokens + returned report tokens
                       + 500 × (1 + repairs)
net range = gross range × quality credit − GPT overhead
```

Credit is 1 for accepted work, 0.5 for reworked work, and 0 for rejected work. Unreviewed work receives no credited estimate; `not-applicable` is excluded. Negative net estimates are retained. Repeated work across separate runs can overlap, and there is no observed direct-GPT counterfactual, so these figures imply **no exact monetary, quota, or percentage savings**. The multipliers and review allowance can be adjusted in settings as evidence improves.

## Other models and procedure changes

Other tools/providers can use `recordExternalRun` from `usage-ledger.cjs`, or record known counters explicitly:

```powershell
node scripts/usage.cjs record --chat <id> --provider other-tool --model model-id --id external-call-1 --status completed --input-tokens 100 --output-tokens 20 --total-tokens 120
```

Unknown counters remain unknown. If a defensible workload estimate is available, add `--workload-tokens <n>`, then record an explicit GPT overhead during review; token volume by itself is not a counterfactual.

The optimization summary groups reviewed observations by model and task kind. It tracks quality, defects, repairs, elapsed time, and GPT review effort; broad routing suggestions need comparable reviewed samples (default minimum 3). Catalog drift can trigger immediate suggestions to investigate or re-verify pricing. Short chat review notes carry process lessons forward. Preserve quality before reducing GPT effort or latency; do not create extra delegation just to improve the savings figures.

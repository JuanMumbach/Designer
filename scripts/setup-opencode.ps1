param(
    [string]$SourceConfig = (Join-Path $PSScriptRoot '../../SynapticGeneral/Synapsis/opencode.json'),
    [string]$GlobalRoot = (Join-Path $env:LOCALAPPDATA 'Yarn/Data/global')
)

$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$apiRoot = [IO.Path]::GetFullPath((Join-Path $appRoot '../DesignerAPI'))
$source = Get-Content -LiteralPath $SourceConfig -Raw | ConvertFrom-Json
foreach ($server in @('context7', 'chrome-devtools', 'memory')) {
    if (-not $source.mcp.$server) { throw "Source MCP configuration is missing $server." }
}
$nodePath = (Get-Command node.exe).Source
$packageRoot = Join-Path $GlobalRoot 'node_modules'
function Get-PackageExecutable([string]$PackageName, [string]$BinaryName) {
    $directory = Join-Path $packageRoot $PackageName
    $package = Get-Content -LiteralPath (Join-Path $directory 'package.json') -Raw | ConvertFrom-Json
    $relative = if ($package.bin -is [string]) { $package.bin } else { $package.bin.$BinaryName }
    $executable = [IO.Path]::GetFullPath((Join-Path $directory $relative))
    if (-not (Test-Path -LiteralPath $executable)) { throw "Missing executable for $PackageName." }
    return $executable
}
$cli = Get-PackageExecutable 'opencode-ai' 'opencode'
$memoryServer = Get-PackageExecutable '@modelcontextprotocol/server-memory' 'mcp-server-memory'
$browserServer = Get-PackageExecutable 'chrome-devtools-mcp' 'chrome-devtools-mcp'
$memoryPath = Join-Path $appRoot '.agents/context-memory/memory.jsonl'
[IO.Directory]::CreateDirectory((Split-Path $memoryPath)) | Out-Null
$codexInstructions = @'
# Codex orchestration

Codex owns requirements, decomposition, difficult debugging, architecture, integration, and final review. Delegate most substantial repository exploration, routine implementation, documentation, and validation to OpenCode free models. Tiny tasks may be completed directly when delegation costs more than the work.

Use the App repository's scripts/run-opencode.cjs launcher with --repo app or --repo api, --agent explore or --agent worker, and --prompt-file pointing to a bounded task file. Use explicit --session IDs for repair follow-ups. Add --browser true only for browser work. The launcher records full JSON transcripts under the App's ignored .opencode/runs directory while returning concise output.

App and API are sibling repositories named Designer and DesignerAPI. Read AGENTS.md in the App and Agent.md in the API. Launch each worker in its assigned repository and specify file ownership, constraints, acceptance criteria, and validation commands. Workers execute directly and do not recursively orchestrate. Use one writer per checkout and preserve pre-existing user changes.

Default to MiMo V2.6 Flash Free for exploration and Big Pickle for implementation. Refresh the OpenCode catalog and check zero input/output prices before the first model use in a session. Never silently use a paid model. Consider another verified free model only after a small comparison task. Allow one repair attempt, then let Codex take over or narrow the task. Retry a transient provider failure once, then try one verified free alternative or report the blocker.

Request at most 400 words: file references or changed files, validation commands and exit results, uncertainties, and blockers. Keep full transcripts and large file dumps out of GPT context. Inspect the diff and relevant evidence before accepting work; worker claims alone are not verification. App checks use Yarn Classic, with yarn lint and yarn tsc --noEmit when appropriate. API checks use dotnet build; do not apply database migrations without task authorization.

Use Context7 for dependency documentation and Memory for durable project facts. Memory storage is shared by App/API and separate from Synapsis. Chrome DevTools is opt-in to limit tool context; do not navigate or interact with unrelated browser pages. Do not store credentials, private request payloads, or full source dumps in memory.

Delegation inherits the parent task's permissions and scope. Never use OpenCode to bypass sandbox or approval restrictions. Obtain required approval before launching a worker outside permitted filesystem/network access. Report unavailable CLI/MCP/authentication clearly and continue authorized independent work where possible. Codex-specific instructions must stay out of shared AGENTS.md and OpenCode worker prompts.
'@
foreach ($repository in @($appRoot, $apiRoot)) {
    $localDirectory = Join-Path $repository '.opencode'
    [IO.Directory]::CreateDirectory($localDirectory) | Out-Null
    $headerReferences = @{}
    foreach ($header in $source.mcp.context7.headers.PSObject.Properties) {
        $localName = 'context7-' + ($header.Name -replace '[^A-Za-z0-9-]', '-') + '.local.txt'
        [IO.File]::WriteAllText((Join-Path $localDirectory $localName), [string]$header.Value)
        $headerReferences[$header.Name] = "{file:./.opencode/$localName}"
    }
    $commonPrompt = 'Execute only your assigned task directly. Read the project instructions first. Preserve existing user changes. Do not spawn other agents, commit, push, publish, or perform unrelated cleanup. Respect parent permissions. Return concise file references or changed files, validation commands and outcomes, and blockers, preferably within 400 words.'
    $config = [ordered]@{
        '$schema' = 'https://opencode.ai/config.json'
        model = 'opencode/big-pickle'
        small_model = 'opencode/mimo-v2.6-flash-free'
        instructions = @($(if ($repository -eq $apiRoot) { 'Agent.md' } else { 'AGENTS.md' }))
        mcp = [ordered]@{
            context7 = @{ type = 'remote'; url = $source.mcp.context7.url; enabled = $true; headers = $headerReferences; timeout = 20000 }
            'chrome-devtools' = @{ type = 'local'; command = @($nodePath, $browserServer, '--headless', '--isolated', '--no-usage-statistics'); enabled = $true; timeout = 20000 }
            memory = @{ type = 'local'; command = @($nodePath, $memoryServer); enabled = $true; environment = @{ MEMORY_FILE_PATH = $memoryPath }; timeout = 10000 }
        }
        tools = @{ 'context7*' = $false; 'memory*' = $false; 'chrome-devtools*' = $false }
        agent = [ordered]@{
            explore = @{
                mode = 'all'; model = 'opencode/mimo-v2.6-flash-free'; description = 'Read-only repository and dependency analysis'
                prompt = "$commonPrompt Do not modify files or memory."
                tools = @{ 'context7*' = $true; 'memory*' = $true; 'chrome-devtools*' = $false }
                permission = @{ edit = 'deny'; bash = 'deny'; task = 'deny'; 'memory_create*' = 'deny'; 'memory_add*' = 'deny'; 'memory_delete*' = 'deny'; external_directory = 'ask' }
            }
            worker = @{
                mode = 'all'; model = 'opencode/big-pickle'; description = 'Bounded implementation and validation'
                prompt = $commonPrompt
                tools = @{ 'context7*' = $true; 'memory*' = $true; 'chrome-devtools*' = $false }
                permission = @{ edit = 'allow'; bash = 'allow'; task = 'deny'; external_directory = 'ask' }
            }
        }
    }
    $config | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $repository 'opencode.json') -Encoding utf8
    $ignorePath = Join-Path $repository '.gitignore'
    $ignore = [IO.File]::ReadAllText($ignorePath)
    foreach ($entry in @('.opencode/*.local.*', '.opencode/runs/', '.agents/context-memory/')) {
        if (-not ($ignore -split '\r?\n' -contains $entry)) { [IO.File]::AppendAllText($ignorePath, "`n$entry`n") }
    }
    $codexDirectory = Join-Path $repository '.codex'
    [IO.Directory]::CreateDirectory($codexDirectory) | Out-Null
    $codexConfigPath = Join-Path $codexDirectory 'config.toml'
    $instructionPath = (Join-Path $codexDirectory 'orchestration.md').Replace('\', '/')
    $launcherPath = (Join-Path $appRoot 'scripts/run-opencode.cjs').Replace('\', '/')
    if ((Test-Path -LiteralPath $codexConfigPath) -and -not ([IO.File]::ReadAllText($codexConfigPath).Contains("Read $instructionPath and follow its OpenCode orchestration policy."))) { throw "Existing Codex configuration needs manual merging: $codexConfigPath" }
    [IO.File]::WriteAllText((Join-Path $codexDirectory 'orchestration.md'), $codexInstructions)
    [IO.File]::WriteAllText($codexConfigPath, "developer_instructions = '''`nRead $instructionPath and follow its OpenCode orchestration policy. The launcher is $launcherPath. These instructions apply to Codex only.`n'''`n")
}
@{ cli = $cli; freeModels = @('opencode/mimo-v2.6-flash-free', 'opencode/big-pickle') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $appRoot '.opencode/runtime.local.json') -Encoding utf8
Write-Output 'Configured OpenCode agents and MCP servers for Designer and DesignerAPI. Credentials are in ignored local files.'

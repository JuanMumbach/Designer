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
                mode = 'all'; model = 'opencode/big-pickle'; steps = 12; description = 'Read-only planning, architecture and repository analysis'
                prompt = "$commonPrompt Do not modify files or memory."
                tools = @{ 'context7*' = $true; 'memory*' = $true; 'chrome-devtools*' = $false }
                permission = @{ edit = 'deny'; bash = 'deny'; task = 'deny'; 'memory_create*' = 'deny'; 'memory_add*' = 'deny'; 'memory_delete*' = 'deny'; external_directory = 'ask' }
            }
            worker = @{
                mode = 'all'; model = 'opencode/big-pickle'; steps = 40; description = 'Bounded implementation, debugging and validation'
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
}
@{ cli = $cli; freeModels = @('opencode/mimo-v2.6-flash-free', 'opencode/big-pickle') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $appRoot '.opencode/runtime.local.json') -Encoding utf8
& python (Join-Path $PSScriptRoot 'install-codex-orchestration.py')
if ($LASTEXITCODE -ne 0) { throw 'Codex orchestration installation failed.' }
Write-Output 'Configured OpenCode agents and MCP servers for Designer and DesignerAPI. Credentials are in ignored local files.'

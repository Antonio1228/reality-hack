param(
  [string]$SupabaseEnvPath = "C:\crypto\jobcraft-ai\.env",
  [string]$OpenAIEnvPath = "C:\crypto\child\.env"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match "^\s*$Name\s*=" } |
    Select-Object -First 1

  if (-not $line) {
    return ""
  }

  return (($line -split "=", 2)[1].Trim().Trim('"').Trim("'"))
}

$supabaseUrl = Get-EnvValue -Path $SupabaseEnvPath -Name "EXPO_PUBLIC_SUPABASE_URL"
if (-not $supabaseUrl) {
  $functionUrl = Get-EnvValue -Path $SupabaseEnvPath -Name "EXPO_PUBLIC_SUPABASE_FUNCTION_URL"
  if ($functionUrl) {
    $supabaseUrl = "https://$(([uri]$functionUrl).Host)"
  }
}
$openAIKey = Get-EnvValue -Path $OpenAIEnvPath -Name "OPENAI_API_KEY"
$openAIModel = Get-EnvValue -Path $OpenAIEnvPath -Name "OPENAI_MODEL"

if (-not $supabaseUrl) {
  throw "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_FUNCTION_URL in $SupabaseEnvPath"
}

if (-not $openAIKey) {
  throw "Missing OPENAI_API_KEY in $OpenAIEnvPath"
}

if (-not $openAIModel) {
  $openAIModel = "gpt-5-mini"
}

$projectRef = ([uri]$supabaseUrl).Host.Split(".")[0]

Write-Output "Using Supabase project ref: $projectRef"
Write-Output "Setting Supabase function secrets without printing secret values..."
$tempSecretFile = New-TemporaryFile
try {
  $secretContent = @(
    "OPENAI_API_KEY=$openAIKey",
    "OPENAI_MODEL=$openAIModel"
  ) -join [Environment]::NewLine
  [System.IO.File]::WriteAllText($tempSecretFile, $secretContent, [System.Text.UTF8Encoding]::new($false))
  npx supabase secrets set --env-file $tempSecretFile --project-ref $projectRef
} finally {
  Remove-Item -LiteralPath $tempSecretFile -Force -ErrorAction SilentlyContinue
}
if ($LASTEXITCODE -ne 0) {
  throw "Failed to set Supabase secrets. Run npx supabase login or set SUPABASE_ACCESS_TOKEN first."
}

Write-Output "Deploying generate-reality-mission function..."
npx supabase functions deploy generate-reality-mission --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Failed to deploy Supabase function. Run npx supabase login or set SUPABASE_ACCESS_TOKEN first."
}

Write-Output "Done."

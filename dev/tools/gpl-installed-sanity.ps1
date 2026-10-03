$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskInstall = Join-Path $env:LOCALAPPDATA 'Programs/WaveCanvas'
$taskEvidence = Join-Path $taskRoot 'dev/reports/archive/gpl-source-2026-10-03'
$taskChecks = [Collections.Generic.List[object]]::new()
function Test-GplInstalled([bool]$value,[string]$label) {
    $taskChecks.Add([pscustomobject]@{pass=$value;label=$label})
    Write-Output ((@('FAIL','PASS')[[int]$value])+' '+$label)
    if(!$value){throw $label}
}
function Get-UserBusinessHashes {
    $taskData=Join-Path $env:APPDATA 'WaveCanvas'
    $taskRecords=@(if(Test-Path -LiteralPath $taskData){Get-ChildItem -LiteralPath $taskData -Recurse -File | Where-Object {$_.Extension -in @('.json','.waveproj','.lrc','.srt','.wav','.mp3','.png') -and $_.FullName -notmatch '\\(Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache)\\'} | ForEach-Object {[pscustomobject]@{path=$_.FullName;hash=(Get-FileHash -LiteralPath $_.FullName).Hash}}})
    ConvertTo-Json -InputObject @($taskRecords|Sort-Object path) -Compress
}
try {
    Test-GplInstalled (@(Get-Process WaveCanvas -ErrorAction SilentlyContinue).Count -eq 0) 'No running WaveCanvas process before installer'
    $taskBefore=Get-UserBusinessHashes
    $taskBefore | Set-Content -Encoding utf8 (Join-Path $taskEvidence 'userdata-before.txt')
    $taskProcess=Start-Process -FilePath (Join-Path $taskRoot 'release/WaveCanvas-Setup-1.0.0.exe') -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru -Wait
    Test-GplInstalled ($taskProcess.ExitCode -eq 0) 'Updated license-only installer completes per-user install'
    Test-GplInstalled ((Get-UserBusinessHashes) -eq $taskBefore) 'Existing normal user business files unchanged'
    $taskFiles = (& node -e "console.log(JSON.stringify(require('./dev/tools/license-resources.cjs')))" | ConvertFrom-Json)
    foreach($taskFile in $taskFiles){
        $taskSource=Join-Path $taskRoot ('licenses/'+$taskFile)
        $taskTarget=Join-Path $taskInstall ('resources/licenses/'+$taskFile)
        Test-GplInstalled ((Test-Path -LiteralPath $taskTarget) -and (Get-FileHash -LiteralPath $taskSource).Hash -eq (Get-FileHash -LiteralPath $taskTarget).Hash) ('Installed license identity '+$taskFile)
    }
    foreach($taskFile in @('ffmpeg.exe','ffprobe.exe')){
        Test-GplInstalled ((Get-FileHash (Join-Path $taskRoot ('vendor/ffmpeg/'+$taskFile))).Hash -eq (Get-FileHash (Join-Path $taskInstall ('resources/ffmpeg/'+$taskFile))).Hash) ('Installed binary unchanged '+$taskFile)
    }
    Test-GplInstalled ((Get-AuthenticodeSignature (Join-Path $taskInstall 'WaveCanvas.exe')).Status -eq 'NotSigned') 'Installed app remains unsigned'
    Test-GplInstalled ((Get-Item 'HKCU:/Software/Classes/WaveCanvas.Project/shell/open/command').GetValue('') -eq ('"'+(Join-Path $taskInstall 'WaveCanvas.exe')+'" "%1"')) 'Quoted project association unchanged'
    $taskEntries=@(Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall' | ForEach-Object {Get-ItemProperty $_.PSPath} | Where-Object DisplayName -like 'WaveCanvas*')
    Test-GplInstalled ($taskEntries.Count -eq 1 -and $taskEntries[0].DisplayVersion -eq '1.0.0') 'Single Installed Apps version 1.0.0'
    Test-GplInstalled (Test-Path -LiteralPath (Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/WaveCanvas.lnk')) 'Start Menu shortcut retained'
    Test-GplInstalled (!(Test-Path -LiteralPath (Join-Path $taskInstall 'resources/gpl-source')) -and @(Get-ChildItem -LiteralPath (Join-Path $taskInstall 'resources') -Recurse -Filter '*GPL-Source*.zip').Count -eq 0) 'Source preparation archive excluded from installer resources'
} finally {
    $taskChecks | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $taskEvidence 'installed-sanity.json')
}

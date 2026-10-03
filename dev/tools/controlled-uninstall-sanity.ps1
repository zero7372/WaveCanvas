$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskInstall=Join-Path $env:LOCALAPPDATA 'Programs/WaveCanvas'
$taskEvidence=Join-Path $taskRoot 'dev/reports/archive/controlled-ffmpeg-2026-10-04/uninstall-sanity.json'
$taskChecks=[Collections.Generic.List[object]]::new()
function Test-Controlled([bool]$value,[string]$label) {
    $taskChecks.Add([pscustomobject]@{pass=$value;label=$label})
    Write-Output ((@('FAIL','PASS')[[int]$value])+' '+$label)
    if(!$value){throw $label}
}
function Get-ControlledBusinessHashes {
    $taskPaths=@((Join-Path $env:APPDATA 'WaveCanvas'),(Join-Path (Split-Path -Parent $taskRoot) 'Untitled'))
    $taskItems=foreach($taskPath in $taskPaths){
        if(Test-Path -LiteralPath $taskPath){Get-ChildItem -LiteralPath $taskPath -Recurse -File |
            Where-Object {$_.Extension -in @('.json','.waveproj','.lrc','.srt','.wav','.mp3','.png') -and $_.FullName -notmatch '\\(Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache)\\'} |
            ForEach-Object {[pscustomobject]@{path=$_.FullName;hash=(Get-FileHash -LiteralPath $_.FullName).Hash}}}
    }
    ConvertTo-Json -InputObject @($taskItems|Sort-Object path) -Compress
}
function Get-ControlledEntries {
    @(Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall' | ForEach-Object {Get-ItemProperty $_.PSPath} | Where-Object DisplayName -like 'WaveCanvas*')
}
try {
    Test-Controlled (@(Get-Process WaveCanvas -ErrorAction SilentlyContinue).Count -eq 0) 'App closed before uninstall'
    $taskBefore=Get-ControlledBusinessHashes
    $taskProcess=Start-Process -FilePath (Join-Path $taskInstall 'Uninstall WaveCanvas.exe') -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru -Wait
    Test-Controlled ($taskProcess.ExitCode -eq 0) 'Controlled installer uninstall succeeds'
    # NSIS can return from its original process before its temporary worker finishes.
    for($taskAttempt=0;$taskAttempt -lt 100;$taskAttempt++){
        $taskPending=(Test-Path -LiteralPath (Join-Path $taskInstall 'WaveCanvas.exe')) -or
            @(Get-ControlledEntries).Count -gt 0 -or
            (Test-Path -LiteralPath (Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/WaveCanvas.lnk')) -or
            (Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'WaveCanvas.lnk'))
        if(!$taskPending){break}
        Start-Sleep -Milliseconds 100
    }
    Test-Controlled (!(Test-Path -LiteralPath (Join-Path $taskInstall 'WaveCanvas.exe'))) 'Uninstall removes app executable'
    Test-Controlled (@(Get-ControlledEntries).Count -eq 0) 'Uninstall removes Installed Apps entry'
    Test-Controlled (!(Test-Path 'HKCU:/Software/Classes/WaveCanvas.Project')) 'Uninstall removes project association'
    Test-Controlled (!(Test-Path -LiteralPath (Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/WaveCanvas.lnk')) -and !(Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'WaveCanvas.lnk'))) 'Uninstall removes shortcuts'
    Test-Controlled ((Get-ControlledBusinessHashes) -eq $taskBefore) 'Uninstall preserves normal user business files and real project/media'
    # Restore the pre-task installed-app state, using the verified new installer.
    $taskProcess=Start-Process -FilePath (Join-Path $taskRoot 'release/WaveCanvas-Setup-1.0.0.exe') -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru -Wait
    Test-Controlled ($taskProcess.ExitCode -eq 0 -and @(Get-ControlledEntries).Count -eq 1) 'Verified controlled installer restores installed app'
    Test-Controlled ((Get-ControlledBusinessHashes) -eq $taskBefore) 'Reinstall preserves business/project files'
    foreach($taskName in @('ffmpeg.exe','ffprobe.exe')){
        Test-Controlled ((Get-FileHash -LiteralPath (Join-Path $taskInstall ('resources/ffmpeg/'+$taskName))).Hash -eq (Get-FileHash -LiteralPath (Join-Path $taskRoot ('vendor/ffmpeg/'+$taskName))).Hash) ('Reinstalled controlled binary identity '+$taskName)
    }
} finally {
    $taskChecks | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 -LiteralPath $taskEvidence
}

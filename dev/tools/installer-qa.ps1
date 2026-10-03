$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskEvidence = Join-Path $taskRoot 'dev/tests/artifacts/installer-qa.json'
$taskFinalInstaller = Join-Path $taskRoot 'release/WaveCanvas-Setup-1.0.0.exe'
$taskUpgradeInstaller = Join-Path $taskRoot 'dist/upgrade-rc/WaveCanvas-Setup-1.0.0-rc.1.exe'
$taskInstallPath = Join-Path $env:LOCALAPPDATA 'Programs/WaveCanvas'
$taskStartLink = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/WaveCanvas.lnk'
$taskDesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WaveCanvas.lnk'
$taskPreservation = Get-Content (Join-Path $taskRoot 'dev/tests/artifacts/release-preservation.json') -Raw | ConvertFrom-Json
$taskChecks = [Collections.Generic.List[object]]::new()
function Test-ReleaseCheck([bool]$value,[string]$label) {
    $taskChecks.Add([pscustomobject]@{pass=$value;label=$label}); Write-Output "$(if($value){'PASS'}else{'FAIL'}) $label"
    $taskChecks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $taskEvidence
    if (!$value) { throw $label }
}
function Get-WaveCanvasEntries {
    @(Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall' | ForEach-Object {Get-ItemProperty $_.PSPath} | Where-Object DisplayName -like 'WaveCanvas*')
}
function Get-PreservationHashes {
    $taskHashPaths = @($taskPreservation.profile, (Join-Path $env:APPDATA 'WaveCanvas'))
    $taskHashItems = foreach ($taskHashPath in $taskHashPaths) {
        if(Test-Path -LiteralPath $taskHashPath) {
            Get-ChildItem -LiteralPath $taskHashPath -File -Recurse | Where-Object {$_.Name -in @('settings.json','application-state.json','recent-projects.json') -or $_.FullName -like '*\Backups\*'} | ForEach-Object { [pscustomobject]@{path=$_.FullName;hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} }
        }
    }
    $taskWorkflowRoot = Split-Path -Parent $taskPreservation.profile
    Get-ChildItem -LiteralPath $taskWorkflowRoot -File -Recurse | Where-Object {$_.FullName -notlike '*\workflow-profile\*' -and $_.Extension -in @('.waveproj','.lrc','.srt','.png','.wav')} | ForEach-Object { $taskHashItems += [pscustomobject]@{path=$_.FullName;hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} }
    @($taskHashItems | Sort-Object path) | ConvertTo-Json -Depth 4 -Compress
}
function Invoke-Uninstall {
    $taskUninstall = Join-Path $taskInstallPath 'Uninstall WaveCanvas.exe'
    $taskProcess = Start-Process -FilePath $taskUninstall -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru -Wait
    Test-ReleaseCheck ($taskProcess.ExitCode -eq 0) 'Uninstaller exits successfully'
    for($taskAttempt=0;$taskAttempt -lt 100 -and (Test-Path -LiteralPath (Join-Path $taskInstallPath 'WaveCanvas.exe'));$taskAttempt++){Start-Sleep -Milliseconds 100}
    Test-ReleaseCheck (!(Test-Path -LiteralPath (Join-Path $taskInstallPath 'WaveCanvas.exe'))) 'Uninstall removes application executable'
    Test-ReleaseCheck (!(Test-Path -LiteralPath $taskStartLink) -and !(Test-Path -LiteralPath $taskDesktopLink)) 'Uninstall removes Start Menu / Desktop shortcuts'
    Test-ReleaseCheck ((Get-WaveCanvasEntries).Count -eq 0) 'Uninstall removes Installed Apps entry'
    $taskAssociationDefault = if (Test-Path 'HKCU:/Software/Classes/.waveproj') {(Get-Item 'HKCU:/Software/Classes/.waveproj').GetValue('')} else {''}
    Test-ReleaseCheck (!(Test-Path 'HKCU:/Software/Classes/WaveCanvas.Project') -and $taskAssociationDefault -ne 'WaveCanvas.Project') 'Uninstall removes registered file association'
}
function Invoke-Install([string]$file,[string]$version) {
    $taskProcess=Start-Process -FilePath $file -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru -Wait
    Test-ReleaseCheck ($taskProcess.ExitCode -eq 0) "Installer $version exits successfully"
    $taskEntries = Get-WaveCanvasEntries
    Test-ReleaseCheck ($taskEntries.Count -eq 1 -and $taskEntries[0].DisplayVersion -eq $version) "Exactly one Installed Apps entry for $version"
    Test-ReleaseCheck ((Test-Path -LiteralPath $taskStartLink) -and (Test-Path -LiteralPath $taskDesktopLink)) 'Shortcuts recreated'
    Test-ReleaseCheck ((Get-Item 'HKCU:/Software/Classes/WaveCanvas.Project/shell/open/command').GetValue('') -eq ('"'+(Join-Path $taskInstallPath 'WaveCanvas.exe')+'" "%1"')) 'Installed quoted association command restored'
    return $taskEntries[0].PSChildName
}
$taskBefore = Get-PreservationHashes
$taskInitialGuid = (Get-WaveCanvasEntries)[0].PSChildName
Invoke-Uninstall
Test-ReleaseCheck ((Get-PreservationHashes) -eq $taskBefore) 'Uninstall preserves original AppData, isolated business data / ten backups and project / media hashes'
$taskRcGuid = Invoke-Install $taskUpgradeInstaller '1.0.0-rc.1'
Test-ReleaseCheck ((Get-PreservationHashes) -eq $taskBefore) 'Internal RC install preserves data'
$taskFinalGuid = Invoke-Install $taskFinalInstaller '1.0.0'
Test-ReleaseCheck ($taskInitialGuid -eq $taskRcGuid[-1] -and $taskInitialGuid -eq $taskFinalGuid[-1]) 'Upgrade uses same GUID / appId and does not duplicate installation'
Test-ReleaseCheck ((Get-PreservationHashes) -eq $taskBefore) 'Upgrade preserves business data and projects'
Invoke-Uninstall
Test-ReleaseCheck ((Get-PreservationHashes) -eq $taskBefore) 'Final uninstall preserves settings, recents, remembered state, backups, projects and media'
$null=Invoke-Install $taskFinalInstaller '1.0.0'
Test-ReleaseCheck ((Get-PreservationHashes) -eq $taskBefore) 'Reinstall preserves all recorded business hashes'

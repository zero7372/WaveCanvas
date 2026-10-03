param(
    [Parameter(Mandatory=$true)][ValidateSet('Verify','Install','Uninstall')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$InstallPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$EvidenceName,
    [bool]$Desktop=$true
)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$taskInstall=[IO.Path]::GetFullPath($InstallPath)
$taskAllowed=@((Join-Path $env:LOCALAPPDATA 'Programs/WaveCanvas'),'D:\Apps\WaveCanvas','D:\應用程式\WaveCanvas 測試')
if($taskInstall -notin $taskAllowed){throw 'Install path outside the explicit installer QA targets'}
$taskEvidence=Join-Path $taskRoot ('dev/reports/archive/installer-ux-2026-10-04/'+$EvidenceName+'.json')
$taskChecks=[Collections.Generic.List[object]]::new()
function Test-Installer([bool]$value,[string]$label){
    $taskChecks.Add([pscustomobject]@{pass=$value;label=$label})
    Write-Output ((@('FAIL','PASS')[[int]$value])+' '+$label)
    if(!$value){throw $label}
}
function Get-BusinessHashes {
    $taskItems=foreach($taskPath in @((Join-Path $env:APPDATA 'WaveCanvas'),(Join-Path (Split-Path -Parent $taskRoot) 'Untitled'))){
        if(Test-Path -LiteralPath $taskPath){Get-ChildItem -LiteralPath $taskPath -Recurse -File |
            Where-Object {$_.Extension -in @('.json','.waveproj','.lrc','.srt','.wav','.mp3','.png') -and $_.FullName -notmatch '\\(Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache)\\'} |
            ForEach-Object {[pscustomobject]@{path=$_.FullName;hash=(Get-FileHash -LiteralPath $_.FullName).Hash}}}
    }
    ConvertTo-Json -InputObject @($taskItems|Sort-Object path) -Compress
}
function Get-Entries {
    @(Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall' | ForEach-Object {Get-ItemProperty $_.PSPath} | Where-Object DisplayName -like 'WaveCanvas*')
}
$taskDesktop=Join-Path ([Environment]::GetFolderPath('Desktop')) 'WaveCanvas.lnk'
$taskStart=Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/WaveCanvas.lnk'
try {
    Test-Installer (@(Get-Process WaveCanvas -ErrorAction SilentlyContinue).Count -eq 0) 'App closed before installer QA'
    $taskBefore=Get-BusinessHashes
    if($Mode -eq 'Install'){
        # /D is last and consumes the entire remaining command line, including spaces.
        $taskNoDesktop=if($Desktop){''}else{' --no-desktop-shortcut'}
        $taskProcess=Start-Process -FilePath (Join-Path $taskRoot 'release/WaveCanvas-Setup-1.0.0.exe') -ArgumentList ('/S /currentuser'+$taskNoDesktop+' /D='+$taskInstall) -WindowStyle Hidden -PassThru -Wait
        Test-Installer ($taskProcess.ExitCode -eq 0) 'Per-user installation succeeds'
    }
    if($Mode -eq 'Uninstall'){
        $taskProcess=Start-Process -FilePath (Join-Path $taskInstall 'Uninstall WaveCanvas.exe') -ArgumentList '/S /currentuser' -WindowStyle Hidden -PassThru -Wait
        Test-Installer ($taskProcess.ExitCode -eq 0) 'Uninstall process succeeds'
        for($taskAttempt=0;$taskAttempt -lt 150;$taskAttempt++){
            $taskPending=(Test-Path -LiteralPath (Join-Path $taskInstall 'WaveCanvas.exe')) -or @(Get-Entries).Count -gt 0 -or (Test-Path -LiteralPath $taskStart) -or (Test-Path -LiteralPath $taskDesktop)
            if(!$taskPending){break}; Start-Sleep -Milliseconds 100
        }
        Test-Installer (!(Test-Path -LiteralPath (Join-Path $taskInstall 'WaveCanvas.exe'))) 'Uninstall removes app binaries'
        Test-Installer (@(Get-Entries).Count -eq 0) 'Uninstall removes Installed Apps entry'
        Test-Installer (!(Test-Path 'HKCU:/Software/Classes/WaveCanvas.Project')) 'Uninstall removes app association'
        Test-Installer (!(Test-Path -LiteralPath $taskStart) -and !(Test-Path -LiteralPath $taskDesktop)) 'Uninstall removes only app shortcuts'
    } else {
        foreach($taskFile in @('WaveCanvas.exe','resources/app.asar','resources/ffmpeg/ffmpeg.exe','resources/ffmpeg/ffprobe.exe')){
            Test-Installer ((Get-FileHash -LiteralPath (Join-Path $taskInstall $taskFile)).Hash -eq (Get-FileHash -LiteralPath (Join-Path $taskRoot ('release/win-unpacked/'+$taskFile))).Hash) ('Installed identity '+$taskFile)
        }
        $taskFiles=(& node -e "console.log(JSON.stringify(require('./dev/tools/license-resources.cjs')))" | ConvertFrom-Json)
        foreach($taskFile in $taskFiles){Test-Installer ((Get-FileHash -LiteralPath (Join-Path $taskInstall ('resources/licenses/'+$taskFile))).Hash -eq (Get-FileHash -LiteralPath (Join-Path $taskRoot ('licenses/'+$taskFile))).Hash) ('Installed license '+$taskFile)}
        $taskEntries=@(Get-Entries)
        Test-Installer ($taskEntries.Count -eq 1 -and $taskEntries[0].DisplayVersion -eq '1.0.0' -and $taskEntries[0].PSChildName -eq '6c2bb522-748e-5bcd-a5ee-9a31dfd50b64') 'Single unchanged app GUID / version'
        Test-Installer ((Get-Item 'HKCU:/Software/Classes/WaveCanvas.Project/shell/open/command').GetValue('') -eq ('"'+(Join-Path $taskInstall 'WaveCanvas.exe')+'" "%1"')) 'Association quotes executable and project'
        Test-Installer (Test-Path -LiteralPath $taskStart) 'Start Menu shortcut exists'
        Test-Installer ((Test-Path -LiteralPath $taskDesktop) -eq $Desktop) 'Desktop shortcut matches selected task'
        $taskShell=New-Object -ComObject WScript.Shell
        Test-Installer ($taskShell.CreateShortcut($taskStart).TargetPath -eq (Join-Path $taskInstall 'WaveCanvas.exe')) 'Start Menu points to selected install location'
        Test-Installer ((Get-AuthenticodeSignature (Join-Path $taskInstall 'WaveCanvas.exe')).Status -eq 'NotSigned') 'App remains unsigned'
    }
    Test-Installer ((Get-BusinessHashes) -eq $taskBefore) 'Operation preserves userData and real projects/media'
    Test-Installer ((Get-BusinessHashes) -eq (Get-Content -LiteralPath (Join-Path $taskRoot 'dev/reports/archive/installer-ux-2026-10-04/business-before.json') -Raw).Trim()) 'Normal business files match pre-task baseline'
} finally {
    [pscustomobject]@{mode=$Mode;installPath=$taskInstall;checks=@($taskChecks)} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath $taskEvidence
}

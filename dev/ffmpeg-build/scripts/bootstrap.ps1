param([string]$WorkspaceRoot='')
$ErrorActionPreference='Stop'
$taskBundle=(Split-Path -Leaf $PSScriptRoot) -eq 'build-scripts'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $(if($taskBundle){'..'}else{'../../..'})))
$taskBase=if($taskBundle){$taskRepo}else{Join-Path $taskRepo 'dev/ffmpeg-build'}
if(!$WorkspaceRoot){$WorkspaceRoot=Join-Path (Split-Path -Parent $taskRepo) '.ffmpeg-build'}
$taskWorkspace=[IO.Path]::GetFullPath($WorkspaceRoot)
if($taskWorkspace -match '\s'){throw 'Choose a short ASCII workspace without spaces; no global PATH changes are needed.'}
$taskLock=Get-Content (Join-Path $taskBase 'manifests/BOOTSTRAP.lock.json') -Raw | ConvertFrom-Json
$taskCache=Join-Path $taskBase $(if($taskBundle){'toolchain-downloads'}else{'workspace'})
New-Item -ItemType Directory -Force $taskCache,$taskWorkspace | Out-Null
$taskArchive=Join-Path $taskCache 'msys2-base.sfx.exe'
if(!(Test-Path -LiteralPath $taskArchive) -or (Get-FileHash -LiteralPath $taskArchive).Hash.ToLowerInvariant() -ne $taskLock.sha256){
    $taskDownload=$taskArchive+'.partial'
    $taskURL=if($taskLock.mirrors){$taskLock.mirrors[0]}else{$taskLock.url}
    Invoke-WebRequest $taskURL -OutFile $taskDownload
    if((Get-FileHash -LiteralPath $taskDownload).Hash.ToLowerInvariant() -ne $taskLock.sha256){throw 'Downloaded MSYS2 base SHA256 mismatch'}
    if(![IO.Path]::GetFullPath($taskArchive).StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar)){throw 'Download target escapes repository'}
    Move-Item -LiteralPath $taskDownload -Destination $taskArchive -Force
}
if((Get-FileHash -LiteralPath $taskArchive).Hash.ToLowerInvariant() -ne $taskLock.sha256){throw 'MSYS2 base SHA256 mismatch'}
$taskBash=Join-Path $taskWorkspace 'msys64/usr/bin/bash.exe'
if(!(Test-Path -LiteralPath $taskBash)){
    $taskExtract=Start-Process -FilePath $taskArchive -ArgumentList '-y',('-o'+$taskWorkspace) -WindowStyle Hidden -PassThru -Wait
    if($taskExtract.ExitCode -ne 0){throw 'MSYS2 base extraction failed'}
}
$env:MSYSTEM='UCRT64';$env:CHERE_INVOKING='1';$env:MSYS2_PATH_TYPE='minimal'
& $taskBash -lc 'true'
if($LASTEXITCODE -ne 0){throw 'MSYS2 initialization failed'}
# Only this isolated package root is modified; no host installation or global update.
$taskPackageLock=Join-Path $taskBase 'manifests/TOOLCHAIN_PACKAGES.lock.json'
if(Test-Path -LiteralPath $taskPackageLock){
    & python (Join-Path $PSScriptRoot 'locked-toolchain.py') $taskRepo $taskWorkspace
    if($LASTEXITCODE -ne 0){throw 'Pinned toolchain download verification failed'}
    $taskPosix='/'+$taskWorkspace.Substring(0,1).ToLowerInvariant()+$taskWorkspace.Substring(2).Replace('\','/')
    & $taskBash -lc ('pacman -U --needed --noconfirm '+$taskPosix+'/toolchain-cache/*.pkg.tar.zst')
}else{
    & $taskBash -lc 'pacman -Sy --needed --noconfirm make git perl diffutils mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-nasm mingw-w64-ucrt-x86_64-pkgconf'
}
if($LASTEXITCODE -ne 0){throw 'Isolated toolchain package installation failed'}
& $taskBash -lc 'pacman -Q'
if($LASTEXITCODE -ne 0){throw 'Toolchain inventory failed'}
Write-Output ('Workspace ready: '+$taskWorkspace)

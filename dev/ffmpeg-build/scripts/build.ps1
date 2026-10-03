param([string]$WorkspaceRoot='',[int]$Jobs=8)
$ErrorActionPreference='Stop'
$taskBundle=(Split-Path -Leaf $PSScriptRoot) -eq 'build-scripts'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $(if($taskBundle){'..'}else{'../../..'})))
$taskBase=if($taskBundle){$taskRepo}else{Join-Path $taskRepo 'dev/ffmpeg-build'}
if(!$WorkspaceRoot){$WorkspaceRoot=Join-Path (Split-Path -Parent $taskRepo) '.ffmpeg-build'}
$taskWorkspace=[IO.Path]::GetFullPath($WorkspaceRoot)
$taskBash=Join-Path $taskWorkspace 'msys64/usr/bin/bash.exe'
if(!(Test-Path -LiteralPath $taskBash)){throw 'Run bootstrap.ps1 first'}
& python (Join-Path $PSScriptRoot 'stage-sources.py') $taskRepo $taskWorkspace
if($LASTEXITCODE -ne 0){throw 'Pinned source verification/staging failed'}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build.sh') -Destination (Join-Path $taskWorkspace 'build.sh')
$env:MSYSTEM='UCRT64';$env:CHERE_INVOKING='1';$env:MSYS2_PATH_TYPE='minimal'
$taskPosix='/'+$taskWorkspace.Substring(0,1).ToLowerInvariant()+$taskWorkspace.Substring(2).Replace('\','/')
& $taskBash -lc ('bash '+$taskPosix+'/build.sh '+$taskPosix+' '+$Jobs)
if($LASTEXITCODE -ne 0){throw 'Controlled build failed; vendor remains unchanged'}
& python (Join-Path $PSScriptRoot 'record-build.py') $taskRepo $taskWorkspace
if($LASTEXITCODE -ne 0){throw 'Source-to-binary provenance capture failed'}
$taskOutput=Join-Path $taskBase 'output'
New-Item -ItemType Directory -Force $taskOutput | Out-Null
Copy-Item -Path (Join-Path $taskWorkspace 'output/*') -Destination $taskOutput -Force

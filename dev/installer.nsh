; Keep a per-user install and remove only WaveCanvas's extension default on uninstall.
; The standard electron-builder macros remove the ProgID and OpenWith entry.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
!macro customInstall
  ; Quote both the executable and project argument, including spaces in the install path.
  WriteRegStr HKCU "Software\Classes\WaveCanvas.Project\shell\open\command" "" '$\"$INSTDIR\WaveCanvas.exe$\" $\"%1$\"'
!macroend
!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Classes\.waveproj" ""
  ${If} $0 == "WaveCanvas.Project"
    DeleteRegValue HKCU "Software\Classes\.waveproj" ""
    DeleteRegKey /ifempty HKCU "Software\Classes\.waveproj"
  ${EndIf}
!macroend

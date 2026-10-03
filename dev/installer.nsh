; Keep a per-user install and remove only WaveCanvas's extension default on uninstall.
; The standard electron-builder macros remove the ProgID and OpenWith entry.
!include Sections.nsh
!include LogicLib.nsh

LangString WC_WELCOME_TITLE 1033 "Welcome to the WaveCanvas Setup Wizard"
LangString WC_WELCOME_TITLE 1028 "歡迎使用 WaveCanvas 安裝精靈"
LangString WC_WELCOME_TEXT 1033 "This wizard will install WaveCanvas ${VERSION} on your computer.$\r$\n$\r$\nClick Next to continue."
LangString WC_WELCOME_TEXT 1028 "此精靈將在您的電腦上安裝 WaveCanvas ${VERSION}。$\r$\n$\r$\n請按「下一步」繼續。"
LangString WC_TASKS 1033 "Additional Tasks"
LangString WC_TASKS 1028 "其他工作"
LangString WC_READY 1033 "Destination: $INSTDIR$\r$\nStart Menu shortcut and .waveproj association included.$\r$\nReady to install."
LangString WC_READY 1028 "安裝位置：$INSTDIR$\r$\n將建立開始功能表捷徑並關聯 .waveproj 檔案。$\r$\n準備安裝。"
LangString WC_TASKS_SUBTEXT 1033 "Review the destination and select additional tasks."
LangString WC_TASKS_SUBTEXT 1028 "確認安裝位置並選擇其他工作。"
LangString WC_SELECT_TASKS 1033 "Select additional tasks:"
LangString WC_SELECT_TASKS 1028 "選擇其他工作："
LangString WC_DESKTOP 1033 "Create a desktop shortcut"
LangString WC_DESKTOP 1028 "建立桌面捷徑"
LangString WC_EXTRACTING 1033 "Extracting WaveCanvas files..."
LangString WC_EXTRACTING 1028 "正在解壓縮 WaveCanvas 檔案..."
LangString WC_EXTRACTED 1033 "Application files extracted. Writing uninstall information and creating the Start Menu shortcut..."
LangString WC_EXTRACTED 1028 "應用程式檔案已解壓縮。正在寫入解除安裝資訊並建立開始功能表捷徑..."
LangString WC_ASSOCIATION 1033 "Registering .waveproj association..."
LangString WC_ASSOCIATION 1028 "正在關聯 .waveproj 檔案..."
LangString WC_FINISH_TITLE 1033 "WaveCanvas has been installed."
LangString WC_FINISH_TITLE 1028 "WaveCanvas 已安裝完成。"

!define MUI_LANGDLL_WINDOWTITLE "WaveCanvas Setup / 安裝"
!define MUI_LANGDLL_INFO "Please select a language / 請選擇語言"
!define MUI_LICENSEPAGE_CHECKBOX
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TITLE "$(WC_FINISH_TITLE)"

!macro customHeader
  ; The builder defaults to nevershow; retain the native collapsible details view.
  ShowInstDetails hide
  ShowUninstDetails hide
!macroend

!ifndef BUILD_UNINSTALLER
  ; Native Components checkbox, selected by default. The mandatory app section
  ; remains hidden/read-only and its install/uninstall workflow stays with builder.
  Section "$(WC_DESKTOP)" WC_DESKTOP_TASK
    SetDetailsPrint both
    DetailPrint "$(WC_EXTRACTING)"
  SectionEnd

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "$(WC_WELCOME_TITLE)"
    !define MUI_WELCOMEPAGE_TEXT "$(WC_WELCOME_TEXT)"
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !macro customFinishPage
    ; This installer is strictly unelevated/per-user. Use MUI's native ExecShell
    ; runner directly; builder's Explorer-delegated shortcut runner failed QA.
    !ifndef HIDE_RUN_AFTER_FINISH
      !define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    !endif
    !insertmacro MUI_PAGE_FINISH
  !macroend

  !macro customPageAfterChangeDir
    ; Builder has reserved this callback for its next InstFiles page. Restore it
    ; after the Components page consumes its own PRE callback.
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
    !define MUI_PAGE_CUSTOMFUNCTION_PRE WC_TasksPre
    !define MUI_COMPONENTSPAGE_NODESC
    !define MUI_PAGE_HEADER_TEXT "$(WC_TASKS)"
    !define MUI_PAGE_HEADER_SUBTEXT "$(WC_TASKS_SUBTEXT)"
    !define MUI_COMPONENTSPAGE_TEXT_TOP "$(WC_READY)"
    !define MUI_COMPONENTSPAGE_TEXT_COMPLIST "$(WC_SELECT_TASKS)"
    !insertmacro MUI_PAGE_COMPONENTS
    !define MUI_PAGE_CUSTOMFUNCTION_PRE instFilesPre
    !define MUI_PAGE_HEADER_SUBTEXT "$(WC_EXTRACTING)"
  !macroend

  Function WC_TasksPre
    ; Use builder's own destination normalization before showing the summary.
    Call instFilesPre
    ; Enumerate the native sections instead of depending on builder's section ID.
    StrCpy $0 0
    ${Do}
      ClearErrors
      SectionGetText $0 $1
      ${If} ${Errors}
        ${ExitDo}
      ${EndIf}
      ${If} $0 != ${WC_DESKTOP_TASK}
        SectionSetText $0 ""
        SectionSetFlags $0 17 ; SF_SELECTED | SF_RO
      ${EndIf}
      IntOp $0 $0 + 1
    ${Loop}
    SectionSetText ${WC_DESKTOP_TASK} "$(WC_DESKTOP)"
  FunctionEnd

  !macro customFiles_x64
    SetDetailsPrint both
    DetailPrint "$(WC_EXTRACTED)"
  !macroend
!endif

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
!macro customInstall
  SetDetailsPrint both
  DetailPrint "$(WC_ASSOCIATION)"
  ; Quote both the executable and project argument, including spaces in the install path.
  WriteRegStr HKCU "Software\Classes\WaveCanvas.Project\shell\open\command" "" '$\"$INSTDIR\WaveCanvas.exe$\" $\"%1$\"'
  ; Optional native section owns only the WaveCanvas desktop link. No custom
  ; registry association flow or external plug-in is introduced.
  SectionGetFlags ${WC_DESKTOP_TASK} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 != 0
  ${AndIfNot} ${isNoDesktopShortcut}
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${Else}
    Delete "$newDesktopLink"
  ${EndIf}
!macroend
!macro customUnInstall
  ${IfNot} ${isKeepShortcuts}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Classes\.waveproj" ""
  ${If} $0 == "WaveCanvas.Project"
    DeleteRegValue HKCU "Software\Classes\.waveproj" ""
    DeleteRegKey /ifempty HKCU "Software\Classes\.waveproj"
  ${EndIf}
!macroend

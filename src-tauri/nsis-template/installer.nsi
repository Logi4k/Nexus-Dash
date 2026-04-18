!include "MUI2.nsh"
!include "FileFunc.nsh"

RequestExecutionLevel admin

!define PRODUCT_NAME "Nexus"
!define PRODUCT_VERSION "@VERSION@"
!define PRODUCT_PUBLISHER "@PUBLISHER@"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "@OUTPUT@"
InstallDir "@INSTALLDIR@"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Function .onInit
  nsExec::Exec 'taskkill /IM Nexus.exe /F'
FunctionEnd

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File "@MAINBINARY@"
CreateDirectory "$SMPROGRAMS\Nexus"
CreateShortCut "$SMPROGRAMS\Nexus\Nexus.lnk" "$INSTDIR\Nexus.exe"
CreateShortCut "$DESKTOP\Nexus.lnk" "$INSTDIR\Nexus.exe"
SectionGroupEnd

Section -AdditionalIcons
  WriteIniStr "$INSTDIR\${PRODUCT_NAME}.url" "InternetShortcut" "URL" "${PRODUCT_WEB_SITE}"
  CreateShortCut "$SMPROGRAMS\Nexus\Uninstall.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_STARTMENU_REGKEY}" "" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Nexus" "$INSTDIR\Nexus.exe"
SectionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  nsExec::Exec 'taskkill /IM Nexus.exe /F'
  MessageBox MB_ICONINFORMATION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
  nsExec::Exec 'taskkill /IM Nexus.exe /F'
  Delete "$INSTDIR\${PRODUCT_NAME}.url"
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\Nexus.exe"
  Delete "$SMPROGRAMS\Nexus\Uninstall.lnk"
  Delete "$SMPROGRAMS\Nexus\Nexus.lnk"
  Delete "$DESKTOP\Nexus.lnk"
  RMDir "$INSTDIR"
  RMDir "$SMPROGRAMS\Nexus"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Run"
  SetAutoClose true
SectionEnd
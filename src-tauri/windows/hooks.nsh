!macro NSIS_HOOK_PREINSTALL
  ExecWait 'taskkill /IM Nexus.exe /F'
!macroend
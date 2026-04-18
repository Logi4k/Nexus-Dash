; Do not taskkill the running app here: the Tauri updater already exits the process before the
; NSIS `/UPDATE` run, and ExecWait on taskkill can fail (non-zero) when no process exists, which
; aborts the installer and surfaces as "update failed" in Settings.
!macro NSIS_HOOK_PREINSTALL
!macroend
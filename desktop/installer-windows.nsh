!macro customInstall
  WriteRegStr HKCU "Software\Classes\lessonara" "" "URL:Lessonara"
  WriteRegStr HKCU "Software\Classes\lessonara" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\lessonara\DefaultIcon" "" '$"$INSTDIR\${APP_EXECUTABLE_FILENAME}$",0'
  WriteRegStr HKCU "Software\Classes\lessonara\shell\open\command" "" '$"$INSTDIR\${APP_EXECUTABLE_FILENAME}$" $"%1$"'
!macroend

!macro customUnInstall
  ReadRegStr $R0 HKCU "Software\Classes\lessonara\shell\open\command" ""
  StrCmp $R0 '$"$INSTDIR\${APP_EXECUTABLE_FILENAME}$" $"%1$"' 0 lessonaraKeepProtocol
  DeleteRegKey HKCU "Software\Classes\lessonara"
  lessonaraKeepProtocol:
!macroend

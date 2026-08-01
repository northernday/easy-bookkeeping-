Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\轻松记账.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "e:\轻松买票\node_modules\electron\dist\electron.exe"
oLink.WorkingDirectory = "e:\轻松买票"
oLink.Description = "轻松记账 - 个人财务管理"
oLink.IconLocation = "e:\轻松买票\node_modules\electron\dist\electron.exe,0"
oLink.Save
WScript.Echo "桌面快捷方式已创建: " & sLinkFile

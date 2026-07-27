@echo off
chcp 65001 >nul
echo ============================================================
echo   DebateTimer 局域网访问 - 防火墙放行脚本
echo   作用：添加一条 Windows 防火墙入站规则，允许 TCP 3000
echo   适用：其他设备无法打开 http://192.168.10.71:3000/ 时
echo ============================================================
echo.
echo [1/2] 先删除同名旧规则（如有）...
netsh advfirewall firewall delete rule name="Nuxt Dev Server TCP 3000" >nul 2>&1

echo [2/2] 添加入站允许规则（专用 + 公用网络）...
netsh advfirewall firewall add rule name="Nuxt Dev Server TCP 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,public

if "%errorlevel%"=="0" (
  echo.
  echo [OK] 规则已添加成功。
  echo      现在同一局域网下的其他设备可直接访问：
  echo      http://192.168.10.71:3000/
  echo.
  echo      注意：本机开发服务器需处于运行状态（npm run dev / nuxt dev --port 3000 --host）
) else (
  echo.
  echo [失败] 错误码 %errorlevel%
  echo      请务必【右键本文件 - 以管理员身份运行】，再点"是"允许。
)
echo.
pause

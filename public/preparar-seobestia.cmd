@echo off
setlocal
cd /d "%~dp0"
if not exist "package.json" (
  if exist "..\server.mjs" cd /d ".."
)
if not exist "server.mjs" goto wrongfolder
where node.exe >nul 2>nul
if errorlevel 1 goto missingnode
node -e "const p=require('./package.json'); process.exit(p.name==='seobestia'?0:1)" >nul 2>nul
if errorlevel 1 goto wrongfolder
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>24||a===24&&b>=14?0:1)"
if errorlevel 1 goto missingnode
if not exist "package-lock.json" goto wrongfolder
where npm.cmd >nul 2>nul
if errorlevel 1 goto missingnode
call npm.cmd ls --omit=dev --depth=0 >nul 2>nul
if not errorlevel 1 goto ready
echo Se instalaran las dependencias fijadas en package-lock.json.
echo Cierra el servidor de SEOBESTIA antes de continuar.
choice /C SN /M "Instalar ahora"
if errorlevel 2 exit /b 0
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto failed
:ready
echo SEOBESTIA esta preparado. Para abrirlo, ejecuta npm start en esta carpeta.
pause
exit /b 0
:missingnode
echo Instala Node.js 24.14 o superior con npm y vuelve a abrir este archivo.
pause
exit /b 1
:wrongfolder
echo Guarda este instalador junto a server.mjs y package-lock.json de SEOBESTIA.
pause
exit /b 1
:failed
echo No se completo la instalacion. Revisa el mensaje anterior y tu conexion.
pause
exit /b 1


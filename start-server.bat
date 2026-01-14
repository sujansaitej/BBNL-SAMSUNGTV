@echo off
echo Starting BBNL Production Proxy Server...
cd /d "%~dp0bbnl-proxy"
node server.js
pause

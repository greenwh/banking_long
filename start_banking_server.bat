@echo off
cd /d "C:\Users\tofm4\OneDrive\Development\Banking_Blue"
start python -m http.server 8002
timeout /t 2 /nobreak >nul
start http://localhost:8002/index.html



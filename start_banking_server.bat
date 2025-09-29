@echo off
cd /d "C:\Users\tofm4\OneDrive\Development\Bank_Register_Long"
start python -m http.server 8002
timeout /t 2 /nobreak >nul
start http://localhost:8002/index.html



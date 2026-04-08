@echo off
setlocal

call "%~dp0?? RetainPDF.cmd"
if errorlevel 1 exit /b 1

call "%~dp0?? RetainPDF.cmd"
exit /b %errorlevel%

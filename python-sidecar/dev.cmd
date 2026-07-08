@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [python-sidecar] Brak .venv — tworzenie lokalnego venv...
  python -m venv .venv
  if errorlevel 1 (
    echo [python-sidecar] Nie udalo sie utworzyc venv.
    exit /b 1
  )
  echo [python-sidecar] Instalacja zaleznosci z requirements.txt...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [python-sidecar] pip install nie powiodl sie — probuje uv...
    uv pip install -r requirements.txt --python ".venv\Scripts\python.exe"
    if errorlevel 1 exit /b 1
  )
)

".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

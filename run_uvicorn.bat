@echo off
cd /d "%~dp0"

python -c "import sqlalchemy" >nul 2>nul
if errorlevel 1 (
    echo [INFO] Missing packages detected. Installing required packages...
    python -m pip install sqlalchemy fastapi uvicorn python-jose "passlib[bcrypt]" pydantic-settings python-multipart
)

if not exist ".env" (
    echo [INFO] .env file not found. Creating .env.example and stopping.
    (
        echo DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/DB_NAME
        echo PROJECT_NAME=Fashion.2.Cation Backend
    ) > ".env.example"
    echo [ERROR] Please create .env from .env.example and set DATABASE_URL / PROJECT_NAME.
    pause
    exit /b 1
)

start "" "http://127.0.0.1:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

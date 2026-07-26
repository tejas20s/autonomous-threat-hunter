@echo off
REM ============================================================================
REM Threat Hunter - Quick Deploy Script for Windows
REM ============================================================================

setlocal enabledelayedexpansion

REM Color codes (using title and output tricks)
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     Threat Hunter - Insider Threat Detection Platform     ║
echo ║              Windows Quick Deploy Script                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM ============================================================================
REM CHECK PREREQUISITES
REM ============================================================================

echo [*] Checking prerequisites...

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker is not installed
    echo     Install from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker found

REM Check Docker Compose
docker compose version >nul 2>&1
if errorlevel 1 (
    docker-compose --version >nul 2>&1
    if errorlevel 1 (
        echo [X] Docker Compose is not installed
        echo     Install from: https://www.docker.com/products/docker-desktop
        pause
        exit /b 1
    )
)
echo [OK] Docker Compose found

REM Check if threat directory exists
if not exist "threat\" (
    echo [X] threat\ directory not found
    echo     Please run this script from the parent directory
    pause
    exit /b 1
)

echo [OK] All prerequisites met
echo.

REM ============================================================================
REM SETUP PROJECT
REM ============================================================================

echo [*] Setting up project...
cd threat

REM Create .env if it doesn't exist
if not exist ".env" (
    echo [!] Creating .env file with defaults...
    (
        echo # JWT Configuration
        echo JWT_SECRET_KEY=change-me-in-production
        echo JWT_ALGORITHM=HS256
        echo JWT_EXPIRATION_HOURS=24
        echo.
        echo # Database Configuration
        echo DATABASE_URL=postgresql+asyncpg://soc_user:soc_password@postgres:5432/insider_threat
        echo.
        echo # Environment
        echo DEBUG=True
        echo ENVIRONMENT=development
        echo.
        echo # CORS
        echo CORS_ORIGINS=http://localhost,http://localhost:3000,http://localhost:5173
        echo.
        echo # Email ^(Optional^)
        echo # SMTP_SERVER=smtp.gmail.com
        echo # SMTP_PORT=587
        echo # SMTP_USERNAME=your-email@gmail.com
        echo # SMTP_PASSWORD=your-app-password
    ) > .env
    echo [OK] Created .env file
) else (
    echo [OK] .env file exists
)

echo.

REM ============================================================================
REM BUILD AND START SERVICES
REM ============================================================================

echo [*] Building and starting services...
echo [!] This may take 2-5 minutes on first run...
echo.

docker compose up --build -d

if errorlevel 1 (
    echo [X] Failed to start services
    docker compose logs
    pause
    exit /b 1
)

echo [OK] Services started
echo.

REM ============================================================================
REM WAIT FOR SERVICES
REM ============================================================================

echo [*] Waiting for services to be ready...

REM Wait for PostgreSQL
echo [*] Waiting for PostgreSQL...
set "attempts=0"
:wait_postgres
docker exec soc-postgres pg_isready -U soc_user -d insider_threat >nul 2>&1
if errorlevel 1 (
    set /a "attempts+=1"
    if !attempts! gtr 30 (
        echo [X] PostgreSQL failed to start
        docker compose logs postgres
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    goto wait_postgres
)
echo [OK] PostgreSQL is ready

REM Wait for data pipeline
echo [*] Waiting for data pipeline...
timeout /t 10 /nobreak >nul

REM Wait for Backend
echo [*] Waiting for backend API...
set "attempts=0"
:wait_backend
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    set /a "attempts+=1"
    if !attempts! gtr 30 (
        echo [!] Backend may still be starting, check logs with:
        echo     docker compose logs backend
        goto continue
    )
    timeout /t 2 /nobreak >nul
    goto wait_backend
)
echo [OK] Backend API is ready

:continue
echo.

REM ============================================================================
REM VERIFY DEPLOYMENT
REM ============================================================================

echo [*] Verifying deployment...
echo.
docker compose ps
echo.

REM ============================================================================
REM PRINT SUMMARY
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                 DEPLOYMENT COMPLETE!                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Access Points:
echo   Dashboard:      http://localhost
echo   API Docs:       http://localhost:8000/docs
echo   Backend API:    http://localhost:8000
echo.
echo Default Credentials:
echo   Email:     admin@example.com
echo   Password:  Admin@123
echo.
echo IMPORTANT:
echo   1. Change default credentials immediately!
echo   2. Update JWT_SECRET_KEY for production
echo   3. Review .env file for configuration
echo.
echo Useful Commands:
echo   View logs:        docker compose logs -f
echo   Stop services:    docker compose down
echo   View status:      docker compose ps
echo   Restart:          docker compose restart
echo.
echo For more info, see: DEPLOYMENT_GUIDE.md
echo.

pause

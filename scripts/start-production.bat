@echo off
REM Production startup script for CodeLabRunner on Windows

echo Starting CodeLab Pro in production mode...

REM Check if required environment variables are set
if "%DATABASE_URL%"=="" (
    echo DATABASE_URL is not set
    exit /b 1
)

if "%REDIS_URL%"=="" (
    echo REDIS_URL is not set
    exit /b 1
)

REM Check Docker availability
echo Checking Docker availability...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Docker is available
    set USE_DOCKER=true
    
    REM Pull required Docker images for code execution
    echo Pulling Docker images for code execution...
    docker pull python:3.11-alpine
    docker pull node:18-alpine
    docker pull openjdk:17-alpine
    docker pull gcc:11-alpine
    docker pull golang:1.21-alpine
    docker pull rust:1.70-alpine
    echo Docker images ready
) else (
    echo Docker is not available, using local execution (less secure)
    set USE_DOCKER=false
)

REM Set production environment
set NODE_ENV=production

REM Start the application
echo Starting Next.js application...
npm start

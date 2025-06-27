@echo off
echo 🚀 Starting LabForCode (Local Compiler Mode)...
echo =============================================

echo.
echo 📦 Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo � Checking local compilers...
python --version
node --version
gcc --version | head -1
go version
rustc --version

echo.
echo �🐳 Starting core services (PostgreSQL + Redis)...
docker-compose -f docker-compose.local.yml up -d
if errorlevel 1 (
    echo ❌ Failed to start Docker services
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 15 /nobreak

echo.
echo 🌐 Opening LabForCode in your browser...
start http://localhost:3000

echo.
echo ✅ LabForCode is now running in LOCAL MODE!
echo.
echo 📍 Access points:
echo    - Web Interface: http://localhost:3000
echo    - API Health: http://localhost:3000/api/health
echo    - Judge0 Compatible API: http://localhost:3000/api/compat
echo    - Admin Panel: http://localhost:3000/admin
echo.
echo 💻 Using LOCAL compilers for faster execution:
echo    - Python 3.13.3
echo    - Node.js v22.14.0  
echo    - GCC 14.2.0
echo    - Go 1.24.1
echo    - Rust 1.87.0
echo.
echo 🔍 To check logs: docker-compose -f docker-compose.local.yml logs -f
echo 🛑 To stop: docker-compose -f docker-compose.local.yml down
echo.
pause

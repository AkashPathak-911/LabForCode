@echo off
REM CodeLab Pro - Windows Production Deployment Script

echo 🚀 CodeLab Pro Production Deployment
echo ====================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 18+ first.
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% found

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not found. Please install Docker Desktop first.
    pause
    exit /b 1
)

echo ✅ Docker found

echo.
echo ⚙️  Setting up production environment...

REM Create production environment if it doesn't exist
if not exist ".env.production" (
    copy .env.local .env.production
    echo ✅ Created .env.production from .env.local
) else (
    echo ✅ .env.production already exists
)

echo.
echo 📦 Installing dependencies...
call npm ci --only=production
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

echo.
echo 🔨 Building application...
call npm run build
if errorlevel 1 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Application built

echo.
echo 🗄️  Starting database services...
docker-compose -f docker-compose.local.yml up -d
if errorlevel 1 (
    echo ❌ Failed to start database services
    pause
    exit /b 1
)
echo ✅ Database services started

echo.
echo ☕ Starting Java compiler service...
docker-compose -f docker-java-only.yml up -d
if errorlevel 1 (
    echo ❌ Failed to start Java service
    pause
    exit /b 1
)
echo ✅ Java compiler service started

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 15 /nobreak >nul

echo.
echo 🧪 Running production tests...
if exist "test-local-compilers.js" (
    node test-local-compilers.js
    echo ✅ Compiler tests completed
)

echo.
echo 🚀 Starting CodeLab Pro in production mode...
echo.
echo Application will be available at: http://localhost:3000
echo API documentation: http://localhost:3000/api/health
echo Admin panel: http://localhost:3000/admin (if enabled)
echo.
echo To stop the application:
echo   docker-compose down
echo   docker-compose -f docker-java-only.yml down
echo.
echo To view logs:
echo   docker-compose logs -f
echo.

REM Start the application
set NODE_ENV=production
npm start

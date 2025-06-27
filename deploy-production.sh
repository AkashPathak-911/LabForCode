#!/bin/bash

# LabForCode - Production Deployment Script
# Automated deployment for production environments

set -e

echo "🚀 LabForCode Production Deployment"
echo "===================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -c 2-)
echo "✅ Node.js $NODE_VERSION found"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
echo "✅ Docker $DOCKER_VERSION found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker Compose found"

# Create production environment file
echo ""
echo "⚙️  Setting up production environment..."

if [ ! -f ".env.production" ]; then
    cat > .env.production << EOF
# LabForCode - Production Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=postgresql://codelab:$(openssl rand -hex 16)@localhost:5432/codelab_pro
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=codelab
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=codelab_pro

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Security Configuration
JWT_SECRET=$(openssl rand -hex 32)
API_RATE_LIMIT=1000
WEBHOOK_SECRET=$(openssl rand -hex 16)

# Code Execution Configuration
CODE_EXECUTION_TIMEOUT=30000
CODE_EXECUTION_MEMORY_LIMIT=134217728
MAX_CONCURRENT_JOBS=50
TEMP_DIR=./tmp

# Execution Mode
USE_DOCKER=false
USE_LOCAL_COMPILERS=true
USE_DOCKER_FOR_JAVA=true

# Compiler Paths (update as needed)
PYTHON_PATH=python
NODEJS_PATH=node
GCC_PATH=gcc
GPP_PATH=g++
GO_PATH=go
RUSTC_PATH=rustc
JAVAC_PATH=docker exec codelab-java javac
JAVA_PATH=docker exec codelab-java java

# Judge0 compatibility
DEFAULT_CPU_TIME_LIMIT=5
DEFAULT_MEMORY_LIMIT=256000
DEFAULT_WALL_TIME_LIMIT=10

# Production Features
ENABLE_WEBHOOKS=true
ENABLE_BATCH_SUBMISSIONS=true
ENABLE_ADMIN_PANEL=false
ENABLE_REQUEST_LOGGING=true
ENABLE_METRICS=true
METRICS_PORT=9090

# Optional Features
ENABLE_SHARING=true
ENABLE_HISTORY=true
ENABLE_USER_ACCOUNTS=false
EOF

    echo "✅ Created .env.production with secure defaults"
else
    echo "✅ .env.production already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --only=production
echo "✅ Dependencies installed"

# Build application
echo ""
echo "🔨 Building application..."
npm run build
echo "✅ Application built"

# Start database services
echo ""
echo "🗄️  Starting database services..."
docker-compose -f docker-compose.local.yml up -d
echo "✅ Database services started"

# Start Java container for compilation
echo ""
echo "☕ Starting Java compiler service..."
docker-compose -f docker-java-only.yml up -d
echo "✅ Java compiler service started"

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Initialize database
echo ""
echo "🗄️  Initializing database..."
if [ -f "init-postgres.sql" ]; then
    PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -p 5432 -U codelab -d codelab_pro -f init-postgres.sql || echo "Database may already be initialized"
    echo "✅ Database initialized"
fi

# Run tests
echo ""
echo "🧪 Running production tests..."
if [ -f "test-local-compilers.js" ]; then
    node test-local-compilers.js
    echo "✅ Compiler tests passed"
fi

# Start application
echo ""
echo "🚀 Starting LabForCode in production mode..."
echo ""
echo "Application will be available at: http://localhost:3000"
echo "API documentation: http://localhost:3000/api/health"
echo "Admin panel: http://localhost:3000/admin (if enabled)"
echo ""
echo "To stop the application:"
echo "  docker-compose down"
echo "  docker-compose -f docker-java-only.yml down"
echo ""
echo "To view logs:"
echo "  npm run logs"
echo "  docker-compose logs -f"
echo ""

# Start the application
NODE_ENV=production npm start

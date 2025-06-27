#!/bin/bash

# Production startup script for CodeLabRunner

echo "🚀 Starting CodeLab Pro in production mode..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo "❌ REDIS_URL is not set"
    exit 1
fi

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/') -p $(echo $DATABASE_URL | sed 's/.*:\([0-9]*\)\/.*/\1/'); do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
REDIS_HOST=$(echo $REDIS_URL | sed 's|redis://||' | sed 's|:[0-9]*||')
REDIS_PORT=$(echo $REDIS_URL | sed 's|.*:||')
until redis-cli -h $REDIS_HOST -p $REDIS_PORT ping; do
    echo "Redis is unavailable - sleeping"
    sleep 2
done
echo "✅ Redis is ready"

# Check Docker availability
echo "🐳 Checking Docker availability..."
if docker --version > /dev/null 2>&1; then
    echo "✅ Docker is available"
    export USE_DOCKER=true
    
    # Pull required Docker images for code execution
    echo "📦 Pulling Docker images for code execution..."
    docker pull python:3.11-alpine
    docker pull node:18-alpine
    docker pull openjdk:17-alpine
    docker pull gcc:11-alpine
    docker pull golang:1.21-alpine
    docker pull rust:1.70-alpine
    docker pull lua:
    echo "✅ Docker images ready"
else
    echo "⚠️  Docker is not available, using local execution (less secure)"
    export USE_DOCKER=false
fi

# Set production environment
export NODE_ENV=production

# Start the application
echo "🎯 Starting Next.js application..."
exec npm start

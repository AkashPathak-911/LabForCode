#!/bin/bash

# Production startup script for CodeLabRunner

set -e

echo "🚀 Starting LabForCode in production mode..."

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "✅ PostgreSQL is ready!"

# Wait for Redis
echo "⏳ Waiting for Redis..."
until redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping | grep -q PONG; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "✅ Redis is ready!"

# Check Docker availability
if docker --version > /dev/null 2>&1; then
  echo "✅ Docker is available"
  export USE_DOCKER=true
else
  echo "⚠️  Docker not available, using local execution"
  export USE_DOCKER=false
fi

# Initialize database if needed
echo "🗄️  Initializing database..."
if [ -f "/app/init.sql" ]; then
  PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /app/init.sql || echo "Database already initialized"
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Start the application
echo "🏃 Starting Next.js application..."
exec npm start

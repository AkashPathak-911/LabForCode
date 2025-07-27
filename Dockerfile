# LabForCode Local Development Dockerfile
FROM node:18-alpine AS base

# Install language runtimes and Docker CLI
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    openjdk17-jdk \
    go \
    rust \
    cargo \
    musl-dev \
    docker-cli \
    postgresql-client \
    redis \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S coderunner && \
    adduser -S coderunner -u 1001 -G coderunner

# Add user to docker group to run Docker commands
RUN addgroup coderunner docker

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Set permissions
RUN chown -R coderunner:coderunner /app
RUN mkdir -p /tmp/code-execution && chown coderunner:coderunner /tmp/code-execution

# Set executable permissions for startup scripts
RUN chmod +x ./scripts/*.sh

# Switch to non-root user
USER coderunner

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use production startup script
CMD ["./scripts/start-production.sh"]

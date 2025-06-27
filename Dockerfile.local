# Production multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production runtime with multiple language runtimes and Docker
FROM node:18-alpine AS runtime

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

# Copy dependencies and build
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

# Set permissions
RUN chown -R coderunner:coderunner /app
RUN mkdir -p /tmp/code-execution && chown coderunner:coderunner /tmp/code-execution

# Copy and set executable permissions for startup scripts
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/start-production.sh

# Switch to non-root user
USER coderunner

EXPOSE 3000

# Use production startup script
CMD ["./scripts/start-production.sh"]

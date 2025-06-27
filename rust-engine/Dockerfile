# Rust execution engine Dockerfile
FROM rust:1.70-slim as builder

WORKDIR /app

# Install system dependencies for compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies for code execution
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    gcc \
    g++ \
    rustc \
    default-jre \
    default-jdk \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd -m -u 1000 coderunner

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/coderunner-engine /app/

# Set ownership
RUN chown -R coderunner:coderunner /app

# Create temp directory for executions
RUN mkdir -p /tmp/code-execution && chown coderunner:coderunner /tmp/code-execution

USER coderunner

EXPOSE 8080

CMD ["./coderunner-engine"]

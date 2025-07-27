# 🐳 Docker Setup Guide

## Simplified Docker Configuration

We've streamlined our Docker setup to avoid confusion and keep only what's essential.

## 📁 Files Overview

| File                            | Purpose                    | When to Use                           |
| ------------------------------- | -------------------------- | ------------------------------------- |
| `Dockerfile`                    | Main application container | Building the app for any environment  |
| `docker-compose.local.yml`      | Minimal local dev setup    | Just need DB + Redis while developing |
| `docker-compose.production.yml` | Full production stack      | Complete containerized deployment     |
| `rust-engine/Dockerfile`        | Rust microservice          | High-performance code execution       |

## 🚀 Usage Scenarios

### **Local Development (Recommended)**

```bash
# Start just PostgreSQL and Redis
docker-compose -f docker-compose.local.yml up -d

# Run the app locally for faster development
pnpm install
pnpm dev
```

### **Full Production Deployment**

```bash
# Everything in containers
docker-compose -f docker-compose.production.yml up -d
```

### **Testing the Main App Container**

```bash
# Build and run just the main app
docker build -t labforcode .
docker run -p 3000:3000 --env-file .env labforcode
```

## 🗑️ What We Removed

- **`Dockerfile.local`** - Was duplicate of main Dockerfile
- **`Dockerfile.production`** - Redundant with docker-compose.production.yml
- **`docker-compose.yml`** - Confusing middle ground
- **`docker-java-only.yml`** - Too specific, better handled in main setup

## 💡 Why This Approach?

1. **Clear separation** between local dev and production
2. **No confusion** about which file to use when
3. **Faster local development** (don't containerize the main app in dev)
4. **Production-ready** full containerization when needed
5. **Easier maintenance** with fewer duplicate files

## 🔧 Environment Variables

Make sure to:

1. Copy `.env.example` to `.env`
2. Update database URLs to match your Docker setup:
   - Local: `postgresql://codelab:password123@localhost:5432/codelab_pro`
   - Production: `postgresql://codelab:password123@postgres:5432/codelab_pro`

## 🚨 Common Issues

**Port conflicts?**

```bash
# Check what's using the ports
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379
```

**Permission issues?**

```bash
# Fix Docker permissions (Linux/Mac)
sudo chown -R $USER:$USER ./tmp
```

**Container won't start?**

```bash
# Check logs
docker-compose -f docker-compose.local.yml logs
```

# LabForCode Deployment Guide

## 🚀 **Deployment Options for LabForCode**

### **1. Local Development (Windows)**

**Use:** `start-windows.bat`

```bash
# Quick local setup
./start-windows.bat
```

**Perfect for:**

- ✅ Local development
- ✅ Testing features
- ✅ Demos and presentations

---

### **2. Production Docker Deployment**

**Use:** `docker-compose.yml`

```bash
# Production with all services
docker-compose up -d
```

**Includes:**

- ✅ LabForCode API (TypeScript)
- ✅ Rust execution engine
- ✅ PostgreSQL database
- ✅ Redis queue system
- ✅ Health checks & monitoring

---

### **3. Cloud Platform Deployment**

#### **🐳 Docker Swarm**

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml codelab-pro
```

#### **☸️ Kubernetes**

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -l app=codelab-pro
```

#### **🌊 Docker Compose (VPS)**

```bash
# On your VPS
git clone <repository>
cd CodeLabRunner
cp .env.example .env
# Edit .env with production values
docker-compose -f docker-compose.yml up -d
```

---

### **4. Platform-as-a-Service (PaaS)**

#### **🚀 Railway**

```bash
# Connect repository to Railway
# Set environment variables
# Deploy automatically
```

#### **🔵 DigitalOcean App Platform**

```yaml
# app.yaml
name: codelab-pro
services:
  - name: api
    source_dir: /
    build_command: npm run build
    run_command: npm start
```

#### **🟢 Heroku**

```bash
# Add Heroku buildpacks
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/emk/heroku-buildpack-rust

# Deploy
git push heroku main
```

---

### **5. AWS Deployment**

#### **🔶 AWS ECS with Fargate**

```bash
# Build and push images
docker build -t codelab-pro .
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag codelab-pro:latest <account>.dkr.ecr.<region>.amazonaws.com/codelab-pro:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/codelab-pro:latest

# Create ECS service
aws ecs create-service --cluster codelab-cluster --service-name codelab-pro
```

#### **☁️ AWS Lambda (Serverless)**

```bash
# Use Serverless Framework
npm install -g serverless
serverless deploy
```

---

### **6. Self-Hosted Production**

#### **🖥️ Linux Server Setup**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone and deploy
git clone <repository>
cd CodeLabRunner
./scripts/start-production.sh
```

#### **🪟 Windows Server Setup**

```powershell
# Install Docker Desktop
# Run production script
.\scripts\start-production.bat
```

---

## **📋 Environment Configuration**

### **Production Environment Variables**

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=codelab
POSTGRES_PASSWORD=secure_password_123
POSTGRES_DB=codelab_pro

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
ENCRYPTION_KEY=32_character_encryption_key_here

# Docker execution
USE_DOCKER=true
DOCKER_TIMEOUT=30000

# Rust engine
USE_RUST_ENGINE=true
RUST_ENGINE_URL=http://rust-engine:8080

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Webhooks
WEBHOOK_SECRET=webhook_secret_for_callbacks

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

---

## **🔒 Security Considerations**

### **Production Security Checklist**

- [ ] **Strong passwords** for database and Redis
- [ ] **JWT secrets** properly configured
- [ ] **HTTPS/TLS** enabled with valid certificates
- [ ] **Firewall rules** configured (only expose necessary ports)
- [ ] **Docker security** (non-root users, resource limits)
- [ ] **Rate limiting** enabled and configured
- [ ] **Input validation** and sanitization
- [ ] **Regular security updates** scheduled

### **Network Security**

```bash
# Only expose necessary ports
# 3000: Main application
# 443: HTTPS (with reverse proxy)
# 80: HTTP (redirect to HTTPS)

# Internal services (not exposed):
# 5432: PostgreSQL
# 6379: Redis
# 8080: Rust engine
```

---

## **📊 Monitoring & Scaling**

### **Health Checks**

- ✅ `/api/health` - Application health
- ✅ `/api/compat/statuses` - Judge0 compatibility
- ✅ Database connectivity
- ✅ Redis connectivity
- ✅ Rust engine status

### **Horizontal Scaling**

```bash
# Scale with Docker Compose
docker-compose up -d --scale app=3 --scale rust-engine=2

# Scale with Kubernetes
kubectl scale deployment codelab-pro --replicas=5
```

### **Load Balancing**

```nginx
# Nginx configuration
upstream codelab_pro {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 443 ssl;
    server_name codelab.yourdomain.com;

    location / {
        proxy_pass http://codelab_pro;
    }
}
```

---

## **🚀 Quick Deployment Commands**

### **Development**

```bash
./start-windows.bat              # Windows development
./startup.sh                     # Linux development
```

### **Production**

```bash
docker-compose up -d             # Docker production
./scripts/start-production.sh    # Self-hosted production
kubectl apply -f k8s/            # Kubernetes production
```

### **Testing**

```bash
./test-judge0-compatibility.sh   # Test Judge0 compatibility
./test-synchronous-mode.sh       # Test synchronous execution
./test-api.sh                    # Test basic functionality
```

---

## **📈 Performance Optimization**

### **For High Load (1000+ requests/min)**

1. **Horizontal scaling**: Multiple app instances
2. **Database optimization**: Connection pooling, read replicas
3. **Redis clustering**: For queue distribution
4. **CDN**: For static assets
5. **Load balancer**: Nginx or cloud load balancer

### **Resource Requirements**

- **Minimum**: 2 CPU, 4GB RAM, 20GB storage
- **Recommended**: 4 CPU, 8GB RAM, 50GB storage
- **High Performance**: 8+ CPU, 16GB+ RAM, SSD storage

---

**Choose the deployment method that best fits your infrastructure and scaling needs!** 🎯

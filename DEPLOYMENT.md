# 🚀 Deployment Guide - Coding Bingo Platform with Docker GCC

This guide covers deploying your application with Docker-based C/C++ compilation support.

---

## 📋 Prerequisites

- Docker installed on your server
- Node.js 20+ (for local builds)
- PostgreSQL database (Neon DB recommended)
- Domain name (optional, for production)

---

## 🎯 Deployment Options

### Option 1: Deploy to Railway (Recommended - Free Tier Available)

**Railway supports Docker and allows you to use Docker-in-Docker for GCC compilation.**

#### Steps:

1. **Sign up at [Railway.app](https://railway.app)**

2. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

3. **Login to Railway:**
   ```bash
   railway login
   ```

4. **Initialize your project:**
   ```bash
   railway init
   ```

5. **Add environment variables:**
   ```bash
   railway variables set DATABASE_URL="your_neon_db_url"
   railway variables set NODE_ENV="production"
   railway variables set PORT="8080"
   railway variables set ADMIN_SECRET="your_secret_key"
   railway variables set USE_ONLINE_COMPILER="false"
   ```

6. **Deploy:**
   ```bash
   railway up
   ```

7. **Get your deployment URL:**
   ```bash
   railway domain
   ```

**Important for Docker-in-Docker:**
- Railway allows privileged containers by default
- Your Docker GCC compilation will work out of the box
- Make sure `Dockerfile` includes Docker installation

---

### Option 2: Deploy to Render

**Render supports Docker deployments with native Docker support.**

#### Steps:

1. **Sign up at [Render.com](https://render.com)**

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Select "Docker" as environment
   - Set build command: `docker build -t coding-bingo .`
   - Set start command: `node dist/server/index.mjs`

3. **Environment Variables (in Render Dashboard):**
   ```
   DATABASE_URL=your_neon_db_url
   NODE_ENV=production
   PORT=8080
   ADMIN_SECRET=your_secret_key
   USE_ONLINE_COMPILER=false
   ```

4. **Deploy:**
   - Push to GitHub
   - Render will auto-deploy

---

### Option 3: Deploy to DigitalOcean App Platform

#### Steps:

1. **Sign up at [DigitalOcean](https://www.digitalocean.com)**

2. **Create App from GitHub:**
   - Select your repository
   - Choose "Dockerfile" as build method

3. **Configure Environment Variables:**
   ```
   DATABASE_URL=your_neon_db_url
   NODE_ENV=production
   PORT=8080
   ADMIN_SECRET=your_secret_key
   ```

4. **Deploy:**
   - Click "Deploy"
   - DigitalOcean handles Docker automatically

---

### Option 4: Self-Hosted VPS (Full Control)

**Best for production with custom requirements.**

#### Required: Ubuntu 22.04+ VPS (AWS EC2, DigitalOcean Droplet, Linode, etc.)

#### Steps:

1. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **Install Docker Compose:**
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

4. **Clone your repository:**
   ```bash
   git clone https://github.com/HEETMEHTA18/Coding-Bingo-Platform.git
   cd Coding-Bingo-Platform
   ```

5. **Create production `.env` file:**
   ```bash
   nano .env
   ```
   
   Add:
   ```env
   DATABASE_URL=postgresql://your_neon_db_url
   NODE_ENV=production
   PORT=8080
   ADMIN_SECRET=your_secret_key_here
   PG_MAX_POOL=20
   USE_ONLINE_COMPILER=false
   ```

6. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d --build
   ```

7. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

8. **Setup Nginx reverse proxy (optional but recommended):**
   ```bash
   sudo apt install nginx -y
   sudo nano /etc/nginx/sites-available/coding-bingo
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   
   Enable:
   ```bash
   sudo ln -s /etc/nginx/sites-available/coding-bingo /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Setup SSL with Let's Encrypt (optional):**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🔧 Update Dockerfile for Docker-in-Docker (Production GCC Support)

Your current Dockerfile doesn't include Docker for GCC compilation. Update it:

```dockerfile
# Use Node.js LTS with Docker support
FROM node:20-alpine AS builder

# Install Docker CLI in builder
RUN apk add --no-cache docker-cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Install Docker CLI and required tools
RUN apk add --no-cache docker-cli ca-certificates

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server/index.mjs"]
```

---

## ⚙️ Alternative: Use Judge0 API for Production (No Docker Needed)

If your hosting platform doesn't support Docker-in-Docker, use the Judge0 API:

1. **Get free API key from [RapidAPI Judge0](https://rapidapi.com/judge0-official/api/judge0-ce)**

2. **Update `.env`:**
   ```env
   USE_ONLINE_COMPILER=true
   JUDGE0_API_KEY=your_rapidapi_key_here
   JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
   ```

3. **Deploy normally** - no Docker-in-Docker needed

---

## 🎬 Quick Start Commands

### Build locally:
```bash
npm run build
```

### Run with Docker Compose:
```bash
docker-compose up -d --build
```

### Stop services:
```bash
docker-compose down
```

### View logs:
```bash
docker-compose logs -f app
```

### Update deployment:
```bash
git pull
docker-compose down
docker-compose up -d --build
```

---

## 🔒 Security Checklist

- [ ] Set strong `ADMIN_SECRET` in production
- [ ] Use HTTPS (SSL certificate)
- [ ] Configure firewall (only allow 80, 443, 22)
- [ ] Keep Docker images updated
- [ ] Use environment variables (never commit `.env`)
- [ ] Enable rate limiting (already configured)
- [ ] Set up automated backups for PostgreSQL

---

## 📊 Monitoring

### Check application health:
```bash
curl http://your-domain.com/api/health
```

### Monitor Docker container:
```bash
docker stats
docker-compose logs -f
```

---

## 🐛 Troubleshooting

### Docker GCC not working in production:
1. Ensure Docker socket is mounted: `-v /var/run/docker.sock:/var/run/docker.sock`
2. Pull GCC image manually: `docker pull gcc:latest`
3. Check Docker permissions in container

### Database connection issues:
1. Verify `DATABASE_URL` is correct
2. Check if Neon DB allows connections from your server IP
3. Test connection: `psql $DATABASE_URL`

### Port conflicts:
1. Change PORT in `.env`
2. Update `docker-compose.yml` port mapping

---

## 💡 Recommended: Railway Deployment (Easiest)

Railway is the best option because:
✅ Free tier available
✅ Auto-deploys from GitHub
✅ Supports Docker-in-Docker natively
✅ Built-in PostgreSQL (optional)
✅ Automatic HTTPS
✅ Simple environment variable management
✅ Great for hobby/startup projects

**Deploy in 2 minutes:**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## 📝 Notes

- **Database**: Your Neon PostgreSQL is already configured and will work in production
- **Docker GCC**: Requires privileged container or Docker socket access
- **Scaling**: For high traffic, consider using Judge0 API instead of Docker GCC
- **Costs**: Railway free tier includes 500 hours/month, sufficient for small projects

Need help? Check logs first: `docker-compose logs -f`

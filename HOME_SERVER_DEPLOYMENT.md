# Home Server Deployment Guide

## Overview

This guide will help you deploy Fantasy Viz to your Ubuntu home server using Docker Compose with an Nginx reverse proxy and automatic SSL certificates.

## Architecture

```
Internet → Router (Port Forward) → Nginx Reverse Proxy → Fantasy Viz App
                                          ↓
                                    Let's Encrypt SSL
```

## Prerequisites

- ✅ Ubuntu server with Docker installed
- ✅ Docker Compose installed
- 🔲 Domain name or Dynamic DNS setup
- 🔲 Ports 80 and 443 forwarded on your router

## Part 1: Initial Setup

### 1.1 Install Docker Compose (if not already installed)

```bash
sudo apt update
sudo apt install docker-compose -y
```

### 1.2 Create Directory Structure

```bash
cd ~
mkdir -p fantasy-viz-deploy
cd fantasy-viz-deploy
```

### 1.3 Clone Your Repository

```bash
git clone https://github.com/joellis13/fantasy-viz.git
cd fantasy-viz
```

## Part 2: Configuration

### 2.1 Create Production Environment File

Create `.env.production` in the project root:

```bash
# Yahoo OAuth Credentials
YAHOO_CLIENT_ID=your_client_id_here
YAHOO_CLIENT_SECRET=your_client_secret_here

# Production URL (replace with your domain or public IP)
BASE_URL=https://yourdomain.com

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# Node Environment
NODE_ENV=production

# Port (internal - don't change unless needed)
PORT=5000
```

**Generate a secure session secret:**

```bash
openssl rand -base64 32
```

### 2.2 Update Yahoo OAuth Redirect URI

Go to your Yahoo Developer Console and add:

- `https://yourdomain.com/auth/yahoo/callback`

Replace `yourdomain.com` with your actual domain.

## Part 3: Docker Setup

### 3.1 Build the Application

The project needs a Dockerfile for the server. Create `Dockerfile` in the `server/` directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy root package files first for workspace resolution
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (both workspaces)
RUN npm ci --workspaces

# Copy server source
COPY server/ ./server/

# Copy client built files (we'll build these locally first)
COPY client/dist/ ./client/dist/

# Build server
WORKDIR /app/server
RUN npm run build

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "dist/index.js"]
```

### 3.2 Create Docker Compose Configuration

Create `docker-compose.yml` in the project root:

```yaml
version: "3.8"

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: fantasy-viz-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
    networks:
      - fantasy-viz-network

  # Certbot for SSL
  certbot:
    image: certbot/certbot
    container_name: fantasy-viz-certbot
    restart: unless-stopped
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

  # Fantasy Viz Application
  app:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: fantasy-viz-app
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - ./server/cache:/app/server/cache
      - ./server/tokens:/app/server/tokens
    networks:
      - fantasy-viz-network
    expose:
      - "5000"

networks:
  fantasy-viz-network:
    driver: bridge
```

### 3.3 Create Nginx Configuration

Create directory and config:

```bash
mkdir -p nginx/conf.d
```

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;

    include /etc/nginx/conf.d/*.conf;
}
```

Create `nginx/conf.d/fantasy-viz.conf`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size limit (for file uploads if needed)
    client_max_body_size 10M;

    # API endpoints - stricter rate limiting
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://app:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth endpoints
    location /auth/ {
        limit_req zone=general_limit burst=10 nodelay;

        proxy_pass http://app:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Root and static files
    location / {
        limit_req zone=general_limit burst=50 nodelay;

        proxy_pass http://app:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Important:** Replace `yourdomain.com` with your actual domain in the config above.

## Part 4: SSL Certificate Setup

### 4.1 Initial Certificate Request

First, create the certbot directories:

```bash
mkdir -p certbot/conf certbot/www
```

Start nginx temporarily to get the initial certificate:

```bash
# Start just nginx for certbot challenge
docker-compose up -d nginx

# Request certificate (replace with your domain and email)
docker-compose run --rm certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com

# Restart nginx to load the certificate
docker-compose restart nginx
```

### 4.2 Certificate Auto-Renewal

The certbot container will automatically check for renewal every 12 hours. Certificates are renewed when they have 30 days or less remaining.

## Part 5: Building and Deployment

### 5.1 Build the Client Locally (Before Docker Build)

On your development machine (Windows):

```bash
cd client
npm install
npm run build
```

This creates `client/dist/` which will be copied into the Docker image.

**Commit the built files temporarily:**

```bash
git add -f client/dist
git commit -m "Add production build"
git push
```

Or use `.dockerignore` to exclude and build in Docker (see Alternative Build Method below).

### 5.2 Deploy to Home Server

On your Ubuntu server:

```bash
# Pull latest code
git pull

# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 5.3 Verify Deployment

1. Check that all containers are running:

```bash
docker-compose ps
```

2. Check logs for errors:

```bash
docker-compose logs app
docker-compose logs nginx
```

3. Test the application:

```bash
curl https://yourdomain.com
```

## Part 6: Router Configuration

### 6.1 Port Forwarding

In your router admin panel, forward these ports to your Ubuntu server's local IP:

- **Port 80 (HTTP)** → Server IP:80 (for certbot challenges and HTTPS redirect)
- **Port 443 (HTTPS)** → Server IP:443 (main application traffic)

### 6.2 Static Local IP (Recommended)

Set a static IP for your server in your router's DHCP settings to prevent the IP from changing.

## Part 7: Domain Setup

### Option A: You Have a Domain

Point your domain's A record to your public IP address:

```
A    @              your.public.ip.address
A    www            your.public.ip.address
```

Find your public IP: `curl ifconfig.me`

### Option B: Dynamic DNS (Free)

If your ISP changes your IP address periodically:

1. Sign up for a free Dynamic DNS service:

   - [DuckDNS](https://www.duckdns.org/) (easiest)
   - [No-IP](https://www.noip.com/)
   - [Dynu](https://www.dynu.com/)

2. Install DDNS client on your server:

```bash
# Example for DuckDNS
mkdir -p ~/duckdns
cd ~/duckdns

# Create update script
cat > duck.sh << 'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
EOF

chmod +x duck.sh

# Add to crontab (runs every 5 minutes)
crontab -e
# Add this line:
# */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

## Part 8: Maintenance

### Updating the Application

```bash
cd ~/fantasy-viz-deploy/fantasy-viz

# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Clean up old images
docker image prune -f
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100 app
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart app
docker-compose restart nginx
```

### Stop/Start

```bash
# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Stop and remove volumes (clears cache)
docker-compose down -v
```

### Backup Important Data

```bash
# Backup tokens and cache
tar -czf fantasy-viz-backup-$(date +%Y%m%d).tar.gz \
  server/tokens/ \
  server/cache/ \
  certbot/conf/

# Restore from backup
tar -xzf fantasy-viz-backup-YYYYMMDD.tar.gz
```

## Part 9: Security Hardening (Optional but Recommended)

### 9.1 Install Fail2Ban

Protects against brute force attacks:

```bash
sudo apt install fail2ban -y

# Create jail for nginx
sudo nano /etc/fail2ban/jail.local
```

Add:

```ini
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime = 3600
```

Restart fail2ban:

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

### 9.2 UFW Firewall

```bash
# Enable UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 9.3 Regular Updates

```bash
# Update system packages weekly
sudo apt update && sudo apt upgrade -y

# Update Docker images monthly
docker-compose pull
docker-compose up -d --build
```

## Part 10: Monitoring (Optional)

### 10.1 Simple Health Check Script

Create `~/health-check.sh`:

```bash
#!/bin/bash

URL="https://yourdomain.com"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$STATUS" != "200" ]; then
    echo "$(date): Site is down! Status: $STATUS" >> ~/health-check.log
    # Optionally restart services
    cd ~/fantasy-viz-deploy/fantasy-viz
    docker-compose restart
fi
```

Add to crontab:

```bash
crontab -e
# Check every 5 minutes
*/5 * * * * ~/health-check.sh
```

### 10.2 View Docker Stats

```bash
# Real-time stats
docker stats

# Or for specific container
docker stats fantasy-viz-app
```

## Troubleshooting

### Issue: Containers won't start

```bash
# Check logs
docker-compose logs

# Check if ports are in use
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Restart Docker daemon
sudo systemctl restart docker
```

### Issue: Can't reach site from internet

1. Check public IP: `curl ifconfig.me`
2. Verify port forwarding in router
3. Test locally: `curl http://localhost:80`
4. Check firewall: `sudo ufw status`
5. Verify DNS propagation: `nslookup yourdomain.com`

### Issue: SSL certificate issues

```bash
# Test certificate renewal
docker-compose run --rm certbot renew --dry-run

# Force renewal
docker-compose run --rm certbot renew --force-renewal

# Restart nginx
docker-compose restart nginx
```

### Issue: App crashes or high memory usage

```bash
# Check memory usage
docker stats

# View app logs
docker-compose logs -f app

# Restart app
docker-compose restart app
```

### Issue: Session not persisting

Make sure `trust proxy` is set in your app (already configured in index.ts):

```typescript
app.set("trust proxy", 1);
```

## Alternative: Build Client in Docker

If you don't want to commit built files, modify the Dockerfile:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm ci --workspaces

# Copy source
COPY server/ ./server/
COPY client/ ./client/

# Build client
WORKDIR /app/client
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --workspace=server --omit=dev

# Copy built files from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

WORKDIR /app/server

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

## Performance Tips

1. **Enable Nginx caching** for static assets (add to nginx config if needed)
2. **Increase worker processes** based on CPU cores
3. **Monitor Docker logs** for bottlenecks: `docker stats`
4. **Use SSD storage** if available for faster cache reads/writes
5. **Set up log rotation** to prevent disk space issues

## Next Steps

After deployment:

1. ✅ Test all functionality (OAuth, player comparison, stats)
2. ✅ Monitor logs for the first 24 hours
3. ✅ Set up automated backups
4. ✅ Configure monitoring/alerts (optional)
5. ✅ Update documentation with your specific domain

## Support

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify all environment variables in `.env.production`
3. Test connectivity: `curl -I https://yourdomain.com`
4. Check Docker status: `docker-compose ps`

---

**Estimated Setup Time:** 30-60 minutes (mostly waiting for SSL cert and Docker builds)

**Cost:** $0 (if you already have a domain) or ~$12/year for domain + free DDNS

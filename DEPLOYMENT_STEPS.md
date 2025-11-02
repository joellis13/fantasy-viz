# Fantasy Viz Deployment - Step by Step Guide

## Your Server Details

- **Public IP:** `108.209.89.147`
- **Access URL:** `http://108.209.89.147`
- **Yahoo OAuth Redirect:** `http://108.209.89.147/auth/yahoo/callback`

---

## Step 1: SSH into Your Server ✅

```bash
ssh username@your-server-ip
```

---

## Step 2: Clone the Repository

```bash
cd ~
git clone https://github.com/joellis13/fantasy-viz.git
cd fantasy-viz
```

---

## Step 3: Create Environment Configuration

Create `.env.production` file:

```bash
nano .env.production
```

Copy and paste this (update the Yahoo credentials):

```bash
# Yahoo OAuth Credentials
YAHOO_CLIENT_ID=your_yahoo_client_id_here
YAHOO_CLIENT_SECRET=your_yahoo_client_secret_here

# Production URL - Your public IP with HTTPS
BASE_URL=https://108.209.89.147

# Session Secret - generate with: openssl rand -base64 32
SESSION_SECRET=paste_generated_secret_here

# Node Environment
NODE_ENV=production

# Port (internal to Docker)
PORT=5000
```

**Generate session secret:**

```bash
openssl rand -base64 32
```

Copy the output and paste it into `SESSION_SECRET` in the file above.

**Save file:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 4: Update Yahoo OAuth Redirect URI

1. Go to [Yahoo Developer Console](https://developer.yahoo.com/apps/)
2. Select your Fantasy Viz app
3. Add redirect URI: `https://108.209.89.147/auth/yahoo/callback`
4. Click Save

---

## Step 5: Update Docker Compose Configuration

```bash
nano docker-compose.yml
```

Replace **entire content** with:

```yaml
version: "3.8"

services:
  # Nginx Reverse Proxy (HTTP only)
  nginx:
    image: nginx:alpine
    container_name: fantasy-viz-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx-simple.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
    networks:
      - fantasy-viz-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Fantasy Viz Application
  app:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: fantasy-viz-app
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
    volumes:
      - ./server/cache:/app/server/cache
      - ./server/tokens:/app/server/tokens
    networks:
      - fantasy-viz-network
    expose:
      - "5000"
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

networks:
  fantasy-viz-network:
    driver: bridge
```

**Save:** `Ctrl+X`, `Y`, `Enter`

---

## Step 6: Create HTTPS Nginx Configuration

```bash
nano nginx/nginx-https.conf
```

Paste this content:

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
                    '"$http_user_agent"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

    # HTTP - Redirect to HTTPS
    server {
        listen 80;
        server_name _;

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name _;

        # SSL Configuration
        ssl_certificate /etc/nginx/certs/selfsigned.crt;
        ssl_certificate_key /etc/nginx/certs/selfsigned.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        client_max_body_size 10M;

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://app:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Auth endpoints
        location /auth/ {
            proxy_pass http://app:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://app:5000;
            proxy_set_header Host $host;
            access_log off;
        }

        # All other requests
        location / {
            limit_req zone=general_limit burst=50 nodelay;

            proxy_pass http://app:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

**Save:** `Ctrl+X`, `Y`, `Enter`

---

## Step 8: Create Required Directories

```bash
mkdir -p server/cache server/tokens
```

---

## Step 9: Build and Start the Application

```bash
docker-compose up -d --build
```

This will take **5-10 minutes** on first run as it:

- Downloads Docker images
- Installs Node.js dependencies
- Builds the client
- Builds the server
- Starts containers

---

## Step 10: Watch the Build Progress

```bash
docker-compose logs -f
```

**Look for:**

- `HTTPS server running at...` (or similar success message)
- No error messages in red

**Exit logs:** Press `Ctrl+C` (containers keep running)

---

## Step 11: Check Container Status

```bash
docker-compose ps
```

**Expected output:**

```
NAME                   STATUS
fantasy-viz-nginx      Up
fantasy-viz-app        Up (healthy)
```

Both should show "Up" status.

---

## Step 12: Test Locally

```bash
# Test HTTPS (ignore certificate warning with -k)
curl -k https://localhost:443
```

**Expected:** HTML content from your app (not an error message)

---

## Step 13: Find Your Server's Local IP

```bash
hostname -I | awk '{print $1}'
```

**Note this IP** - you'll need it for router configuration (e.g., `192.168.1.100`)

---

## Step 13: Configure Router Port Forwarding

### Access Your Router

1. Open browser on your home network
2. Go to your router's IP (usually `192.168.1.1` or `192.168.0.1`)
3. Log in with admin credentials

### Add Port Forwarding Rule

**Look for:** "Port Forwarding", "Virtual Server", "NAT", or "Applications" section

**Create rule:**

- **Service Name:** Fantasy-Viz
- **External Port:** `80`
- **Internal IP:** Your server's local IP (from Step 12)
- **Internal Port:** `80`
- **Protocol:** TCP
- **Status:** Enabled

**Save/Apply** the changes.

---

## Step 14: Configure Firewall (if UFW is enabled)

Check if firewall is active:

```bash
sudo ufw status
```

If it shows "Status: active", allow port 80:

```bash
sudo ufw allow 80/tcp
```

---

## Step 15: Test from External Network

### From Your Phone (using cellular data, NOT WiFi)

Or from a computer on a different network:

Open browser and go to:

```
http://108.209.89.147
```

**Expected:** You should see the Fantasy Viz home page! 🎉

---

## Step 17: Test OAuth Login

1. Click **"Connect Yahoo"** button
2. Log in with your Yahoo account
3. Approve the app
4. You should be redirected back to your app

**If this works, you're done!** 🎊

---

## Troubleshooting

### Containers Won't Start

```bash
# View detailed logs
docker-compose logs app

# Check for port conflicts
sudo netstat -tulpn | grep :80

# Restart Docker daemon
sudo systemctl restart docker
docker-compose up -d
```

### Can't Access from Outside

**Test connectivity:**

```bash
# From server
curl http://localhost:80

# From another device on same network
curl http://YOUR_SERVER_LOCAL_IP:80
```

**Common issues:**

1. Router port forwarding not configured correctly
2. Firewall blocking port 80
3. ISP blocking port 80 (some ISPs do this)

**Check firewall:**

```bash
sudo ufw status
# If active, run:
sudo ufw allow 80/tcp
```

### Yahoo OAuth Requires HTTPS

If Yahoo won't accept `http://` redirect URI:

**Option 1:** Use ngrok (temporary):

```bash
# Install ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Run (requires ngrok account)
ngrok http 80
```

**Option 2:** Set up self-signed SSL (let me know and I'll provide steps)

### App Shows Errors

```bash
# View app logs
docker-compose logs -f app

# Restart app
docker-compose restart app

# Full rebuild
docker-compose down
docker-compose up -d --build
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart if needed
docker-compose restart app
```

---

## Daily Operations

### View Logs

```bash
docker-compose logs -f app
```

### Restart After Code Changes

```bash
cd ~/fantasy-viz
git pull
docker-compose up -d --build
```

### Stop Everything

```bash
docker-compose down
```

### Start Everything

```bash
docker-compose up -d
```

### Check Status

```bash
docker-compose ps
```

---

## Security Notes

**Current setup is HTTP only (not secure for production).**

For a production deployment with sensitive data:

1. Get a domain name
2. Set up Let's Encrypt SSL certificates
3. Force HTTPS
4. Enable additional security headers

But for testing and personal use, this HTTP setup is fine!

---

## Next Steps

1. ✅ Complete Steps 1-16
2. ✅ Test the app thoroughly
3. 🔲 (Optional) Set up a domain and SSL
4. 🔲 (Optional) Add monitoring
5. 🔲 (Optional) Set up automated backups

---

## Need Help?

If you get stuck at any step, check:

1. Docker logs: `docker-compose logs -f`
2. Container status: `docker-compose ps`
3. Network connectivity: `curl http://localhost:80`
4. Router port forwarding settings
5. Firewall status: `sudo ufw status`

---

**Your app will be available at:** `https://108.209.89.147`

**Remember:** You'll need to accept the security warning in your browser (this is normal for self-signed certificates).

Good luck! 🚀

# Fantasy Viz Deployment - Step by Step Guide

## Your Server Details

- **Server Local IP:** `192.168.1.170`
- **Public IP:** `108.209.89.147`
- **Access URL:** `https://108.209.89.147`
- **Yahoo OAuth Redirect:** `https://108.209.89.147/auth/yahoo/callback`

---

## Before You Start - Quick Checklist

Make sure you have:
- ✅ Ubuntu server with Docker and Docker Compose installed
- ✅ SSH access to your server
- ✅ Yahoo Developer App created (Client ID and Secret)
- ✅ Access to your router's admin panel (for port forwarding)
- ✅ Your server's local IP: `192.168.1.170`
- ✅ Your public IP: `108.209.89.147`

**Time estimate:** 30-45 minutes

---

## Important: Docker Compose File

This guide uses **`docker-compose.ip.yml`** (IP-based deployment with self-signed SSL).

For convenience, create an alias after cloning the repo:

```bash
alias dc='docker-compose -f docker-compose.ip.yml'
```

Then use `dc` instead of `docker-compose` throughout this guide.

**Note**: The main `docker-compose.yml` is for domain-based deployment with Let's Encrypt.

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

## Step 5: Generate Self-Signed SSL Certificate

Since we're using HTTPS with your IP address, we need a self-signed certificate:

```bash
# Create certs directory if it doesn't exist
mkdir -p server/certs

# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server/certs/selfsigned.key \
  -out server/certs/selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=108.209.89.147"
```

This creates:
- `server/certs/selfsigned.key` - Private key
- `server/certs/selfsigned.crt` - Certificate

**Note**: Browsers will show a security warning because this is self-signed. That's expected and safe for personal use.

---

## Step 6: Verify Configuration Files

The repository already includes the necessary configuration files. Let's verify they exist:

```bash
# Check docker-compose.ip.yml exists
ls -la docker-compose.ip.yml

# Check nginx HTTPS config exists
ls -la nginx/nginx-https.conf

# Optional: Set up the alias now
alias dc='docker-compose -f docker-compose.ip.yml'
```

All configuration files are ready to use! No manual editing needed.

---

## Step 7: Build and Start the Application

Use the IP-specific Docker Compose file:

```bash
docker-compose -f docker-compose.ip.yml up -d --build
```

This will take **5-10 minutes** on first run as it:

- Downloads Docker images
- Installs Node.js dependencies
- Builds the client
- Builds the server
- Starts containers

---

## Step 8: Monitor the Build

Watch the build progress:

```bash
docker-compose -f docker-compose.ip.yml logs -f
```

**Look for:**

- `Server running at...` (or similar success message)
- No error messages in red

**Exit logs:** Press `Ctrl+C` (containers keep running)

---

## Step 9: Check Container Status

Verify both containers are running:

```bash
docker-compose -f docker-compose.ip.yml ps
```

**Expected output:**

```
NAME                   STATUS
fantasy-viz-nginx      Up
fantasy-viz-app        Up (healthy)
```

Both should show "Up" status.

---

## Step 10: Test Locally

```bash
# Test HTTPS (ignore certificate warning with -k)
curl -k https://localhost:443
```

**Expected:** HTML content from your app (not an error message)

---

## Step 11: Verify Your Server's Local IP

Your server's local IP is: **`192.168.1.170`**

You can confirm this with:
```bash
hostname -I | awk '{print $1}'
```

You'll need this IP for router port forwarding configuration.

---

## Step 12: Configure Router Port Forwarding

### Access Your Router

1. Open browser on your home network
2. Go to your router's IP (usually `192.168.1.1` or `192.168.0.1`)
3. Log in with admin credentials

### Add Port Forwarding Rules

**Look for:** "Port Forwarding", "Virtual Server", "NAT", or "Applications" section

**Create TWO rules (one for HTTP, one for HTTPS):**

**Rule 1 - HTTP (redirects to HTTPS):**
- **Service Name:** Fantasy-Viz-HTTP
- **External Port:** `80`
- **Internal IP:** `192.168.1.170` (your server's local IP)
- **Internal Port:** `80`
- **Protocol:** TCP
- **Status:** Enabled

**Rule 2 - HTTPS (main traffic):**
- **Service Name:** Fantasy-Viz-HTTPS
- **External Port:** `443`
- **Internal IP:** `192.168.1.170` (your server's local IP)
- **Internal Port:** `443`
- **Protocol:** TCP
- **Status:** Enabled

**Save/Apply** the changes.

---

## Step 13: Configure Firewall (if UFW is enabled)

Check if firewall is active:

```bash
sudo ufw status
```

If it shows "Status: active", allow ports 80 and 443:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## Step 14: Test from External Network

### From Your Phone (using cellular data, NOT WiFi)

Or from a computer on a different network:

Open browser and go to:

```
https://108.209.89.147
```

**Browser Security Warning:**
- You'll see a warning about the self-signed certificate
- Click "Advanced" → "Proceed to 108.209.89.147" (or similar)
- This is safe - it's your own certificate

**Expected:** You should see the Fantasy Viz home page! 🎉

---

## Step 15: Test OAuth Login

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
docker-compose -f docker-compose.ip.yml logs app

# Check for port conflicts
sudo netstat -tulpn | grep :443

# Restart Docker daemon
sudo systemctl restart docker
docker-compose -f docker-compose.ip.yml up -d
```

### Can't Access from Outside

**Test connectivity:**

```bash
# From server
curl -k https://localhost:443

# From another device on same network
curl -k https://192.168.1.170:443
```

**Common issues:**

1. Router port forwarding not configured correctly (need both 80 and 443)
2. Firewall blocking ports 80/443
3. Self-signed certificate issue (use `-k` with curl to ignore)

**Check firewall:**

```bash
sudo ufw status
# If active, run:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### App Shows Errors

```bash
# View app logs
docker-compose -f docker-compose.ip.yml logs -f app

# Restart app
docker-compose -f docker-compose.ip.yml restart app

# Full rebuild
docker-compose -f docker-compose.ip.yml down
docker-compose -f docker-compose.ip.yml up -d --build
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart if needed
docker-compose -f docker-compose.ip.yml restart app
```

---

## Daily Operations

### View Logs

```bash
docker-compose -f docker-compose.ip.yml logs -f app
```

### Restart After Code Changes

```bash
cd ~/fantasy-viz
git pull
docker-compose -f docker-compose.ip.yml up -d --build
```

### Stop Everything

```bash
docker-compose -f docker-compose.ip.yml down
```

### Start Everything

```bash
docker-compose -f docker-compose.ip.yml up -d
```

### Check Status

```bash
docker-compose -f docker-compose.ip.yml ps
```

---

## Security Notes

1. **Self-Signed Certificate**: Browser warnings are expected and safe for personal use
2. **Firewall**: Keep only ports 80 and 443 open
3. **Environment Variables**: Never commit `.env.production` to git
4. **Session Secret**: Keep it secure - it protects your sessions
5. **Yahoo Credentials**: Keep your client ID and secret private

---

## Next Steps

1. ✅ Complete Steps 1-15
2. ✅ Test the app thoroughly
3. 🔲 (Optional) Set up a domain and Let's Encrypt SSL
4. 🔲 (Optional) Add monitoring
5. 🔲 (Optional) Set up automated backups

---

## Need Help?

If you get stuck at any step, check:

1. Docker logs: `docker-compose -f docker-compose.ip.yml logs -f`
2. Container status: `docker-compose -f docker-compose.ip.yml ps`
3. Network connectivity: `curl -k https://localhost:443`
4. Router port forwarding settings (both 80 and 443)
5. Firewall status: `sudo ufw status`

---

**Your app will be available at:** `https://108.209.89.147`

**Remember:** You'll need to accept the security warning in your browser (this is normal for self-signed certificates).

---

**Deployment Complete!** 🎉 Enjoy your Fantasy Viz app!

# Quick Reference: Home Server Deployment

> **⚠️ NOTE:** This guide is for **domain-based deployment** with Let's Encrypt.
> 
> **For IP-based deployment** (e.g., `https://108.209.89.147`), see **[DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md)** instead.

## First Time Setup

1. **On your server:**

   ```bash
   git clone https://github.com/joellis13/fantasy-viz.git
   cd fantasy-viz
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **The script will prompt you for:**

   - Your domain name
   - Your email (for SSL certificates)

3. **It will automatically:**
   - Create `.env.production` from example
   - Update nginx configs with your domain
   - Build Docker containers
   - Request SSL certificate
   - Start all services

## Daily Commands

```bash
# View logs
docker-compose logs -f app

# Restart after code changes
git pull
docker-compose up -d --build

# Check status
docker-compose ps

# Stop all services
docker-compose down

# Start services
docker-compose up -d
```

## Port Forwarding Required

Forward these ports on your router to your server:

- Port 80 (HTTP) → Cert renewal and HTTPS redirect
- Port 443 (HTTPS) → Main application

## Troubleshooting

**Site not accessible:**

```bash
# Check containers
docker-compose ps

# Check logs
docker-compose logs nginx
docker-compose logs app

# Verify ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

**SSL certificate issues:**

```bash
# Test renewal
docker-compose run --rm certbot renew --dry-run

# Force new certificate
docker-compose run --rm certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos --force-renewal \
  -d yourdomain.com
```

**Full restart:**

```bash
docker-compose down
docker-compose up -d --build
```

## Performance vs Render.com

Your home server should be **much faster** because:

- ✅ No cold starts
- ✅ Direct connection (no shared infrastructure)
- ✅ Full control over resources
- ✅ Local caching works efficiently
- ✅ Better API response times

## Security Notes

- Firewall: Only ports 80, 443, and SSH should be exposed
- Updates: Run `sudo apt update && sudo apt upgrade` monthly
- Backups: Back up `server/tokens/` and `certbot/conf/` regularly
- Monitoring: Check logs daily for the first week

## Cost Comparison

- **Render.com:** Free tier (very slow) or $7+/month
- **Home Server:** $0/month + ~$12/year for domain (optional)

---

See [HOME_SERVER_DEPLOYMENT.md](HOME_SERVER_DEPLOYMENT.md) for complete documentation.

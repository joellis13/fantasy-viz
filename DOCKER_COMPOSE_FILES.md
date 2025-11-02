# Docker Compose Configuration Files

This project includes two Docker Compose configurations for different deployment scenarios.

## 📄 `docker-compose.yml` (Domain-Based Deployment)

**Use this for:** Production deployment with a custom domain name

**Features:**
- ✅ Let's Encrypt SSL certificates with auto-renewal
- ✅ Certbot service for certificate management
- ✅ Nginx configured for domain-based routing
- ✅ Production-ready with automatic HTTPS

**Requirements:**
- Custom domain name
- DNS configured to point to your server
- Ports 80 and 443 accessible from internet

**Configuration Files:**
- Nginx: `nginx/nginx.conf` + `nginx/conf.d/fantasy-viz.conf`
- Environment: `.env.production` with `BASE_URL=https://yourdomain.com`

**Deployment Guide:** [HOME_SERVER_DEPLOYMENT.md](./HOME_SERVER_DEPLOYMENT.md)

**Usage:**
```bash
docker-compose up -d --build
```

---

## 📄 `docker-compose.ip.yml` (IP-Based Deployment)

**Use this for:** Personal deployment using public IP address only

**Features:**
- ✅ Self-signed SSL certificates (no domain required)
- ✅ Simplified 2-service setup (no Certbot)
- ✅ Perfect for home server deployment
- ⚠️ Browser will show security warning (acceptable for personal use)

**Requirements:**
- Public IP address or router with port forwarding
- Ports 80 and 443 accessible from internet
- OpenSSL for certificate generation

**Configuration Files:**
- Nginx: `nginx/nginx-https.conf`
- Environment: `.env.production` with `BASE_URL=https://YOUR_IP`
- Certificates: Self-signed in `server/certs/`

**Deployment Guide:** [DEPLOYMENT_STEPS.md](./DEPLOYMENT_STEPS.md)

**Usage:**
```bash
docker-compose -f docker-compose.ip.yml up -d --build
```

**Tip:** Create an alias for convenience:
```bash
alias dc='docker-compose -f docker-compose.ip.yml'
dc up -d --build
```

---

## Quick Comparison

| Feature | `docker-compose.yml` | `docker-compose.ip.yml` |
|---------|---------------------|------------------------|
| **SSL Type** | Let's Encrypt (auto-renew) | Self-signed (manual) |
| **Domain Required** | ✅ Yes | ❌ No |
| **Services** | 3 (nginx, certbot, app) | 2 (nginx, app) |
| **Browser Warning** | ❌ None | ⚠️ Self-signed cert warning |
| **Setup Complexity** | Higher (DNS, DDNS optional) | Lower (IP only) |
| **Best For** | Public production | Personal/home use |
| **Cert Renewal** | Automatic | Manual (yearly) |

---

## Migration Path

**Starting with IP → Moving to Domain:**

1. Acquire a domain name
2. Configure DNS A record to point to your server IP
3. Switch to `docker-compose.yml`
4. Update `.env.production` with new `BASE_URL`
5. Update Yahoo OAuth redirect URI
6. Run Let's Encrypt certificate generation
7. Deploy with `docker-compose up -d --build`

All necessary configuration files are already in the repository!

---

## Which One Should I Use?

**Use `docker-compose.ip.yml` if:**
- You don't have a domain name
- You're deploying for personal use
- You want a simpler setup
- Browser security warnings are acceptable

**Use `docker-compose.yml` if:**
- You have a domain name
- You want a production-grade deployment
- You need automatic certificate renewal
- You want no browser security warnings

---

## Common Commands

### IP-Based Deployment
```bash
# Start services
docker-compose -f docker-compose.ip.yml up -d

# View logs
docker-compose -f docker-compose.ip.yml logs -f

# Stop services
docker-compose -f docker-compose.ip.yml down

# Restart app only
docker-compose -f docker-compose.ip.yml restart app
```

### Domain-Based Deployment
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart app only
docker-compose restart app
```

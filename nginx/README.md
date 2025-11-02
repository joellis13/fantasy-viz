# Nginx Configuration

This directory contains Nginx reverse proxy configurations for Fantasy Viz.

## Active Configuration (IP-based HTTPS deployment)

**Currently using:** `nginx-https.conf`

This file provides:
- HTTPS with self-signed certificate
- HTTP→HTTPS redirect
- Rate limiting
- Proxy configuration for the app

This is the configuration used for IP-based deployment (e.g., `https://108.209.89.147`)

## Unused Files (Domain-based Deployment)

The following files are for **domain-based deployments with Let's Encrypt** and are NOT needed for IP-based deployment:

- `nginx.conf` - Main config (requires domain)
- `conf.d/fantasy-viz.conf` - Site config (requires domain + Let's Encrypt)

These can be ignored unless you switch to a domain name in the future.

## Current Setup

For the IP-based deployment (`https://108.209.89.147`):
- **Config file:** `nginx-https.conf`
- **Certificate:** Self-signed (in `../certs/`)
- **Ports:** 80 (redirect) and 443 (HTTPS)

## Modifying Rate Limits

If you need to adjust rate limits, edit `nginx-https.conf`:

```nginx
# Current limits:
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;      # API: 10 req/sec
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;  # General: 30 req/sec
```

After changes:
```bash
docker-compose restart nginx
```

## Logs

View nginx logs:
```bash
docker-compose logs -f nginx
```

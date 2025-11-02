# Nginx Configuration

This directory contains the Nginx reverse proxy configuration for Fantasy Viz.

## Files

- `nginx.conf` - Main Nginx configuration
- `conf.d/fantasy-viz.conf` - Site-specific configuration with SSL and rate limiting

## Important: Update Your Domain

Before deploying, replace `yourdomain.com` in `conf.d/fantasy-viz.conf` with your actual domain name.

The `deploy.sh` script will do this automatically for you.

## Manual Update

```bash
# Replace all instances of yourdomain.com with your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' conf.d/fantasy-viz.conf
```

## Rate Limits

The configuration includes three rate limiting zones:

1. **API endpoints** (`/api/*`): 10 requests/second with burst of 20
2. **Auth endpoints** (`/auth/*`): 5 requests/minute with burst of 5
3. **General requests**: 30 requests/second with burst of 50

You can adjust these in `conf.d/fantasy-viz.conf` if needed.

## SSL Certificates

SSL certificates are managed by Certbot and stored in the `../certbot/conf/` directory.

The certificates are automatically mounted into the Nginx container via Docker Compose.

## Testing Configuration

To test the Nginx configuration before restarting:

```bash
docker-compose exec nginx nginx -t
```

## Reloading Configuration

After making changes to the configuration:

```bash
docker-compose restart nginx
```

## Logs

Nginx logs are stored in a Docker volume and can be viewed with:

```bash
# Access logs
docker-compose exec nginx cat /var/log/nginx/access.log

# Error logs
docker-compose exec nginx cat /var/log/nginx/error.log

# Follow logs in real-time
docker-compose logs -f nginx
```

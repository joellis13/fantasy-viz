#!/bin/bash

# Fantasy Viz Home Server Deployment Script
# This script is for DOMAIN-BASED deployment with Let's Encrypt SSL
#
# ⚠️  For IP-based deployment (e.g., https://108.209.89.147), 
#     follow DEPLOYMENT_STEPS.md instead - it's simpler!
#
# This script helps set up the Docker environment on your Ubuntu server

set -e  # Exit on error

echo "==================================="
echo "Fantasy Viz Deployment Setup"
echo "==================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script is designed for Linux/Ubuntu servers"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/engine/install/ubuntu/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Installing..."
    sudo apt update
    sudo apt install docker-compose -y
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  .env.production not found"
    echo ""
    
    if [ -f .env.production.example ]; then
        echo "Creating .env.production from example..."
        cp .env.production.example .env.production
        echo "✅ Created .env.production"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env.production and add your:"
        echo "   - YAHOO_CLIENT_ID"
        echo "   - YAHOO_CLIENT_SECRET"
        echo "   - BASE_URL (your domain)"
        echo "   - SESSION_SECRET (generate with: openssl rand -base64 32)"
        echo ""
        read -p "Press Enter when you've updated .env.production..."
    else
        echo "❌ .env.production.example not found"
        exit 1
    fi
fi

# Prompt for domain name
echo ""
read -p "Enter your domain name (e.g., fantasy.yourdomain.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name is required"
    exit 1
fi

echo ""
echo "Updating nginx configuration with domain: $DOMAIN"

# Update nginx config with actual domain
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/conf.d/fantasy-viz.conf

echo "✅ Nginx configuration updated"
echo ""

# Create necessary directories
echo "Creating directories for persistent data..."
mkdir -p server/cache
mkdir -p server/tokens
mkdir -p certbot/conf
mkdir -p certbot/www

echo "✅ Directories created"
echo ""

# Prompt for email (for Let's Encrypt)
read -p "Enter your email address (for SSL certificate notifications): " EMAIL

if [ -z "$EMAIL" ]; then
    echo "❌ Email is required for Let's Encrypt"
    exit 1
fi

echo ""
echo "==================================="
echo "Ready to Deploy!"
echo "==================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Ensure ports 80 and 443 are forwarded to this server"
echo "2. Ensure your domain points to your public IP: $(curl -s ifconfig.me)"
echo "3. Build and start the application:"
echo "   docker-compose up -d --build"
echo ""
echo "4. Request SSL certificate:"
echo "   docker-compose run --rm certbot certonly --webroot \\"
echo "     --webroot-path=/var/www/certbot \\"
echo "     --email $EMAIL \\"
echo "     --agree-tos --no-eff-email \\"
echo "     -d $DOMAIN"
echo ""
echo "5. Restart nginx to load certificate:"
echo "   docker-compose restart nginx"
echo ""
echo "6. Test your deployment:"
echo "   curl https://$DOMAIN"
echo ""
echo "==================================="
echo ""

read -p "Do you want to start the deployment now? (y/n): " START_NOW

if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    echo ""
    echo "Building and starting containers..."
    docker-compose up -d --build
    
    echo ""
    echo "Waiting for services to start (30 seconds)..."
    sleep 30
    
    echo ""
    echo "Requesting SSL certificate..."
    docker-compose run --rm certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos --no-eff-email \
        -d "$DOMAIN"
    
    echo ""
    echo "Restarting nginx..."
    docker-compose restart nginx
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "Your application should now be available at: https://$DOMAIN"
    echo ""
    echo "View logs with: docker-compose logs -f"
    echo "Check status with: docker-compose ps"
else
    echo ""
    echo "Setup complete. Run the commands above manually when ready."
fi

echo ""
echo "==================================="
echo "Deployment setup finished!"
echo "==================================="

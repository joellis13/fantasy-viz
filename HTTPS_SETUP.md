# HTTPS Setup Guide for Yahoo OAuth

## What Was Fixed

1. **Changed BASE_URL from HTTP to HTTPS** in `.env`
2. **Changed FRONTEND_URL from HTTP to HTTPS** in `.env`
3. **Updated Vite config** to serve frontend over HTTPS using your certificates
4. **Updated proxy settings** in Vite to target HTTPS backend
5. **Added Yahoo Fantasy Sports API scope** (`fspt-r`) to the OAuth request

## Critical Step: Update Yahoo Developer App Settings

**⚠️ IMPORTANT:** You must update your Yahoo Developer App configuration to use HTTPS:

1. Go to https://developer.yahoo.com/apps/
2. Select your app
3. Find the **Redirect URI(s)** section
4. Update or add: `https://localhost:5000/auth/yahoo/callback`
5. Save the changes

**Note:** Yahoo may take a few minutes to propagate the changes.

## How to Run

1. **Start the backend:**

   ```powershell
   cd server
   npm run dev
   ```

   You should see: `HTTPS server running at https://localhost:5000`

2. **Start the frontend:**

   ```powershell
   cd client
   npm run dev
   ```

   You should see it running at: `https://localhost:3000`

3. **Accept the SSL certificate warning:**
   - When you first visit `https://localhost:3000`, your browser will warn about the self-signed certificate
   - Click "Advanced" and "Proceed to localhost" (or similar)
   - This is expected for local development with self-signed certificates

## Testing the OAuth Flow

1. Visit `https://localhost:3000` (note the HTTPS)
2. Click "Connect Yahoo Account"
3. You should be redirected to Yahoo's login page
4. After logging in, you'll be redirected back to your app

## Troubleshooting

### If Yahoo still shows an error:

- **Double-check** the redirect URI in Yahoo Developer Console matches exactly: `https://localhost:5000/auth/yahoo/callback`
- Ensure you've saved the changes in Yahoo Developer Console
- Try clearing your browser cookies/cache
- Wait a few minutes for Yahoo's changes to propagate

### If the certificate doesn't work:

- Your certificates are valid until Oct 25, 2026
- Make sure both files exist:
  - `server/certs/localhost.pem`
  - `server/certs/localhost-key.pem`

### If the backend won't start on HTTPS:

- Check the server console output
- Verify the certificate files are readable
- The server will automatically fall back to HTTP if certificates are missing

### Browser-specific SSL warnings:

- **Chrome/Edge:** Click "Advanced" → "Proceed to localhost (unsafe)"
- **Firefox:** Click "Advanced" → "Accept the Risk and Continue"
- This is normal for self-signed certificates in development

## Environment Variables (.env)

Your current configuration:

```
BASE_URL=https://localhost:5000
FRONTEND_URL=https://localhost:3000
PORT=5000
```

SSL certificate paths are auto-detected from `server/certs/` directory.

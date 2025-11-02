# Deploying Fantasy Viz to Render.com

This guide walks you through deploying the Fantasy Viz app to Render.com for free.

## Prerequisites

1. A GitHub account with this repository pushed
2. A Render.com account (free, no credit card required)
3. Yahoo Developer App credentials (for OAuth)

## Step 1: Update Yahoo Developer App Settings

1. Go to [Yahoo Developer Console](https://developer.yahoo.com/apps/)
2. Select your app
3. Add your Render URL to **Redirect URI(s)**:
   - Format: `https://your-app-name.onrender.com/auth/yahoo/callback`
   - Example: `https://fantasy-viz.onrender.com/auth/yahoo/callback`
4. Save changes

## Step 2: Deploy to Render

### Option A: Using the Dashboard (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Render will detect the `render.yaml` file automatically
5. Click **Apply** to use the configuration

### Option B: Using Blueprint (if render.yaml isn't detected)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Blueprint**
3. Connect your repository
4. Render will read `render.yaml` and create the service

## Step 3: Set Environment Variables

In the Render dashboard for your service, go to **Environment** and add:

| Variable              | Value                                                    | Notes                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------- |
| `YAHOO_CLIENT_ID`     | `your_client_id`                                         | From Yahoo Developer Console              |
| `YAHOO_CLIENT_SECRET` | `your_client_secret`                                     | From Yahoo Developer Console              |
| `YAHOO_REDIRECT_URI`  | `https://your-app-name.onrender.com/auth/yahoo/callback` | Must match Yahoo app settings             |
| `SESSION_SECRET`      | Auto-generated                                           | Render will generate this                 |
| `NODE_ENV`            | `production`                                             | Already set in render.yaml                |
| `PORT`                | `5000`                                                   | Already set in render.yaml                |
| `BASE_URL`            | `https://your-app-name.onrender.com`                     | Optional - your app's public URL          |
| `FRONTEND_URL`        | `https://your-app-name.onrender.com`                     | Optional - same as BASE_URL in production |

## Step 4: Deploy!

1. Click **Save** on environment variables
2. Render will automatically build and deploy your app
3. Wait 5-10 minutes for the build to complete
4. Your app will be live at `https://your-app-name.onrender.com`

## Important Notes

### Free Tier Limitations

⚠️ **Your app will spin down after 15 minutes of inactivity**

- First request after spin-down takes 30-60 seconds to wake up
- File-based cache (`server/cache/`) persists between restarts
- Tokens stored in `tokens.json` persist between restarts

### OAuth Tokens

- Users will need to re-authenticate if:
  - The server restarts (deployments)
  - Their tokens expire (1 hour for access tokens)
- Auto-refresh should handle most cases transparently

### API Rate Limiting

- Yahoo API has rate limits
- The app uses 50ms delays between requests
- File caching reduces API calls significantly

### Monitoring

- Check logs in Render dashboard: **Logs** tab
- Monitor for errors or timeout issues
- Free tier has some CPU/memory limits

## Testing Your Deployment

1. Visit `https://your-app-name.onrender.com`
2. Click **Connect Yahoo**
3. Authorize the app
4. Click **Show My Leagues** to see your Yahoo leagues
5. Select a league and click **Load League**

## Troubleshooting

### "Not authenticated" errors

- Check that `YAHOO_REDIRECT_URI` exactly matches Yahoo Developer Console
- Verify `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` are correct

### Build failures

- Check build logs in Render dashboard
- Ensure `render.yaml` is in the repository root
- Verify both `client` and `server` folders have `package.json`

### Server timeout on first request

- This is normal on free tier after spin-down
- Refresh the page after 30-60 seconds

### Yahoo OAuth errors

- Make sure redirect URI in Yahoo app matches exactly
- Check that Yahoo app is not in development mode (if restricted)

## Updating Your Deployment

Render automatically deploys when you push to your connected branch (usually `main`):

```bash
git add .
git commit -m "Update deployment"
git push origin main
```

Render will rebuild and redeploy automatically (takes 5-10 minutes).

## Cost Considerations

**Render Free Tier:**

- ✅ 750 hours/month (enough for 1 app running 24/7)
- ✅ Free SSL/HTTPS
- ✅ Automatic deployments from GitHub
- ❌ Spins down after 15 min inactivity
- ❌ 512MB RAM limit

**For production use**, consider upgrading to:

- Render Starter plan ($7/month): No spin-down, more resources
- Add Redis or Postgres for persistent token storage

## Alternative: Deploying to Railway

If you prefer Railway.app instead:

1. Create `railway.toml` (similar to render.yaml)
2. Set same environment variables
3. Railway has $5 free credit/month
4. No spin-down on free tier (until credit runs out)

Let me know if you'd like Railway deployment instructions!

import express from "express";
import cookieSession from "cookie-session";
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import { normalizeLeague } from "./parsers";

dotenv.config();

const app = express();
app.use(express.json());

const {
  YAHOO_CLIENT_ID,
  YAHOO_CLIENT_SECRET,
  BASE_URL = "http://localhost:5000",
  FRONTEND_URL = "http://localhost:3000",
  SESSION_SECRET = "dev-secret"
} = process.env;

if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET) {
  console.warn("YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET are not set. Set them for OAuth to work.");
}

app.use(
  cookieSession({
    name: "session",
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
  })
);

// In-memory token store for POC (replace with DB in production)
const tokenStore = new Map<string, any>();

function buildYahooAuthUrl(state: string) {
  const authUrl = "https://api.login.yahoo.com/oauth2/request_auth";
  const params = new URLSearchParams({
    client_id: YAHOO_CLIENT_ID || "",
    redirect_uri: `${BASE_URL}/auth/yahoo/callback`,
    response_type: "code",
    language: "en-us"
    // Add scope param here if needed, e.g. scope: "fspt-w"
  });
  params.set("state", state);
  return `${authUrl}?${params.toString()}`;
}

app.get("/auth/yahoo/login", (req, res) => {
  const state = Math.random().toString(36).slice(2);
  req.session!.oauthState = state;
  res.redirect(buildYahooAuthUrl(state));
});

app.get("/auth/yahoo/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || req.session!.oauthState !== state) {
    return res.status(400).send("Invalid OAuth state or missing code");
  }
  try {
    const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
    const data = qs.stringify({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: `${BASE_URL}/auth/yahoo/callback`
    });
    const authHeader = Buffer.from(`${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await axios.post(tokenUrl, data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authHeader}`
      }
    });
    const tokens = tokenRes.data;
    const userId = `user-${Math.random().toString(36).slice(2)}`;
    tokenStore.set(userId, tokens);
    req.session!.userId = userId;
    res.redirect(`${FRONTEND_URL}`);
  } catch (err: any) {
    console.error("Token exchange error:", err.response?.data || err.message);
    res.status(500).send("OAuth token exchange failed");
  }
});

// Helper to get token for current session
function getTokenForReq(req: express.Request) {
  const uid = req.session!.userId;
  if (!uid) return null;
  return tokenStore.get(uid) || null;
}

// Proxy endpoint: get league by leagueKey and normalize
app.get("/api/league/:leagueKey", async (req, res) => {
  const token = getTokenForReq(req);
  if (!token) return res.status(401).json({ error: "not authenticated" });

  const leagueKey = req.params.leagueKey;
  try {
    // Request standings (format=json)
    const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
      leagueKey
    )}/standings?format=json`;

    const resp = await axios.get(yahooUrl, {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });

    const normalized = normalizeLeague(resp.data);

    res.json(normalized);
  } catch (err: any) {
    console.error("Error fetching league:", err.response?.data || err.message);
    res.status(500).json({ error: "failed to fetch league", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

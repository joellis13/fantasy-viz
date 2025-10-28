import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import crypto from "crypto";
import express from "express";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import axios from "axios";
import qs from "qs";
import { normalizeLeague, normalizePlayerComparison } from "./parsers";

dotenv.config();

const app = express();
app.use(express.json());

const {
  YAHOO_CLIENT_ID,
  YAHOO_CLIENT_SECRET,
  BASE_URL = "http://localhost:5000",
  FRONTEND_URL = "http://localhost:3000",
  SESSION_SECRET = "dev-secret",
  SSL_CERT_PATH,
  SSL_KEY_PATH,
} = process.env;

if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET) {
  console.warn(
    "YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET are not set. Set them for OAuth to work."
  );
}

app.use(
  cookieSession({
    name: "session",
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: BASE_URL.startsWith("https://"),
    sameSite: "lax",
  })
);

// Helper token store (POC). Replace with DB in production.
const tokenStore = new Map<string, any>();

function buildYahooAuthUrl(state: string) {
  const authUrl = "https://api.login.yahoo.com/oauth2/request_auth";
  const params = new URLSearchParams({
    client_id: YAHOO_CLIENT_ID || "",
    redirect_uri: `${BASE_URL}/auth/yahoo/callback`,
    response_type: "code",
    language: "en-us",
    scope: "openid fspt-r", // fspt-r for Fantasy Sports Read access
  });
  params.set("state", state);
  return `${authUrl}?${params.toString()}`;
}

// Debug-friendly login handler: returns constructed URL when ?debug=1
app.get("/auth/yahoo/login", (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session!.oauthState = state;
  const url = buildYahooAuthUrl(state);
  console.log("Yahoo auth URL:", url);
  if (req.query.debug) return res.json({ url });
  res.redirect(url);
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
      redirect_uri: `${BASE_URL}/auth/yahoo/callback`,
    });
    const authHeader = Buffer.from(
      `${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`
    ).toString("base64");
    const tokenRes = await axios.post(tokenUrl, data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authHeader}`,
      },
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

function getTokenForReq(req: express.Request) {
  const uid = req.session!.userId;
  if (!uid) return null;
  return tokenStore.get(uid) || null;
}

app.get("/api/league/:leagueKey", async (req, res) => {
  const token = getTokenForReq(req);
  if (!token) return res.status(401).json({ error: "not authenticated" });

  const leagueKey = req.params.leagueKey;
  try {
    const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
      leagueKey
    )}/standings?format=json`;
    console.log("Fetching league from Yahoo API:\n", yahooUrl);
    const resp = await axios.get(yahooUrl, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });
    console.log("Raw league data:", JSON.stringify(resp.data, null, 2));
    const normalized = normalizeLeague(resp.data);
    res.json(normalized);
  } catch (err: any) {
    console.error("Error fetching league:", err.response?.data || err.message);
    res
      .status(500)
      .json({ error: "failed to fetch league", details: err.message });
  }
});

/**
 * Get player comparison data for a team's roster across all weeks
 * GET /api/team/:teamKey/player-comparison?startWeek=1&endWeek=17
 *
 * This endpoint fetches roster data for each week and compiles projected vs actual points
 * for all players on the team throughout the season, enabling trend analysis.
 */
app.get("/api/team/:teamKey/player-comparison", async (req, res) => {
  const token = getTokenForReq(req);
  if (!token) return res.status(401).json({ error: "not authenticated" });

  const teamKey = req.params.teamKey;
  const startWeek = parseInt(String(req.query.startWeek || "1"), 10);
  const endWeek = parseInt(String(req.query.endWeek || "17"), 10);

  // Validate week range
  if (
    isNaN(startWeek) ||
    isNaN(endWeek) ||
    startWeek < 1 ||
    endWeek > 18 ||
    startWeek > endWeek
  ) {
    return res.status(400).json({
      error: "Invalid week range",
      details:
        "startWeek and endWeek must be between 1-18 and startWeek <= endWeek",
    });
  }

  try {
    console.log(
      `Fetching player comparison for team ${teamKey}, weeks ${startWeek}-${endWeek}`
    );

    // Fetch roster data for each week in parallel
    const weeklyPromises: Promise<{ week: number; data: any }>[] = [];

    for (let week = startWeek; week <= endWeek; week++) {
      const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${encodeURIComponent(
        teamKey
      )}/roster;week=${week}?format=json`;

      const promise = axios
        .get(yahooUrl, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        })
        .then((resp) => ({ week, data: resp.data }))
        .catch((err) => {
          console.warn(`Failed to fetch week ${week}:`, err.message);
          return { week, data: null };
        });

      weeklyPromises.push(promise);
    }

    // Wait for all requests to complete
    const weeklyResponses = await Promise.all(weeklyPromises);

    // Filter out failed requests
    const validResponses = weeklyResponses.filter((r) => r.data !== null);

    if (validResponses.length === 0) {
      return res.status(500).json({
        error: "Failed to fetch any roster data",
        details: "All weekly roster requests failed",
      });
    }

    console.log(
      `Successfully fetched ${validResponses.length} weeks of roster data`
    );

    // Parse and normalize the data
    const playerComparisons = normalizePlayerComparison(validResponses);

    res.json({
      teamKey,
      weekRange: { start: startWeek, end: endWeek },
      weeksRetrieved: validResponses.length,
      players: playerComparisons,
      summary: {
        totalPlayers: playerComparisons.length,
        averageAccuracy:
          playerComparisons.length > 0
            ? playerComparisons.reduce(
                (sum, p) => sum + p.summary.accuracyRate,
                0
              ) / playerComparisons.length
            : 0,
      },
    });
  } catch (err: any) {
    console.error(
      "Error fetching player comparison:",
      err.response?.data || err.message
    );
    res.status(500).json({
      error: "failed to fetch player comparison",
      details: err.message,
    });
  }
});

/**
 * Server start logic with optional HTTPS for local dev:
 * - Set BASE_URL to an https:// URL to start HTTPS.
 * - Ensure SSL_CERT_PATH and SSL_KEY_PATH (or defaults server/certs/localhost.pem and server/certs/localhost-key.pem) exist.
 */
const PORT = process.env.PORT || 5000;
const baseUrl = (BASE_URL || `http://localhost:${PORT}`).toLowerCase();

function createHttpServer() {
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP server running at http://localhost:${PORT}`);
  });
}

function createHttpsServer(certPath?: string, keyPath?: string) {
  try {
    const certFile =
      certPath ||
      SSL_CERT_PATH ||
      path.join(process.cwd(), "certs", "localhost.pem");
    const keyFile =
      keyPath ||
      SSL_KEY_PATH ||
      path.join(process.cwd(), "certs", "localhost-key.pem");

    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
      console.warn("HTTPS cert or key file not found.", { certFile, keyFile });
      console.warn(
        "Falling back to HTTP. Generate certs (mkcert or OpenSSL) and set SSL_CERT_PATH/SSL_KEY_PATH in .env."
      );
      createHttpServer();
      return;
    }

    const options = {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    };

    https.createServer(options, app).listen(PORT, () => {
      console.log(`HTTPS server running at ${baseUrl}`);
    });
  } catch (err) {
    console.error("Failed to start HTTPS server, falling back to HTTP:", err);
    createHttpServer();
  }
}

if (baseUrl.startsWith("https://")) {
  createHttpsServer();
} else {
  createHttpServer();
}

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
import swaggerUi from "swagger-ui-express";
import { RegisterRoutes } from "./routes";
import {
  setTokenForUserId,
  getTokenForUserId,
} from "./controllers/LeagueController";

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

// Swagger API Documentation - using tsoa-generated swagger.json
try {
  const swaggerDocument = JSON.parse(
    fs.readFileSync(path.join(__dirname, "swagger.json"), "utf8")
  );

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "Fantasy Viz API Documentation",
      customCss: ".swagger-ui .topbar { display: none }",
    })
  );

  console.log(`Swagger UI available at ${BASE_URL}/api-docs`);
} catch (err) {
  console.warn("Failed to load Swagger documentation:", err);
}

// Register tsoa-generated routes
RegisterRoutes(app);

// Helper token store (POC). Replace with DB in production.
// Moved to shared location for controllers
// const tokenStore = new Map<string, any>();

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
  // console.log("Yahoo auth URL:", url);
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
    setTokenForUserId(userId, tokens);
    req.session!.userId = userId;
    res.redirect(`${FRONTEND_URL}`);
  } catch (err: any) {
    console.error("Token exchange error:", err.response?.data || err.message);
    res.status(500).send("OAuth token exchange failed");
  }
});

// Debug endpoint to get current access token (development only)
app.get("/debug/token", (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = getTokenForUserId(userId);
  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }

  res.json({
    message: "Copy this token for test scripts",
    accessToken: token.access_token,
    expiresIn: token.expires_in,
    tokenType: token.token_type,
  });
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

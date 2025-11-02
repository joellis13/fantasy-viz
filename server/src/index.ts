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
import { setTokenForUserId, getTokenForUserId } from "./tokenStore";

dotenv.config();

const app = express();
app.use(express.json());

// Trust proxy - Render uses a proxy for HTTPS
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const {
  YAHOO_CLIENT_ID,
  YAHOO_CLIENT_SECRET,
  BASE_URL = "http://localhost:5000",
  FRONTEND_URL = "http://localhost:3000",
  SESSION_SECRET = "dev-secret",
  SSL_CERT_PATH,
  SSL_KEY_PATH,
} = process.env;

const isProduction = process.env.NODE_ENV === "production";

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
    secure: isProduction || BASE_URL.startsWith("https://"),
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

// OAuth routes - MUST come before static file serving
app.get("/auth/yahoo/login", (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session!.oauthState = state;
  const url = buildYahooAuthUrl(state);
  if (req.query.debug) return res.json({ url });
  res.redirect(url);
});

app.get("/auth/yahoo/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || req.session!.oauthState !== state) {
    console.error("[OAuth Callback] State mismatch or missing code");
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
app.get("/debug/token", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = await getTokenForUserId(userId);
  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }

  res.json({
    message: "Copy this token for test scripts",
    accessToken: token.access_token,
  });
});

// Health check endpoint for Docker and monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// In production, serve the built client app
// MUST come AFTER all API and auth routes
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientBuildPath));

  // Serve index.html for all unmatched routes (SPA support)
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

/**
 * Server start logic:
 * - In production (NODE_ENV=production): Use HTTP (Render provides HTTPS proxy)
 * - In development: Use HTTPS if BASE_URL starts with https:// and certs are available
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

// Production: Always use HTTP (Render provides HTTPS)
if (isProduction) {
  createHttpServer();
  console.log(`Server running in production mode on port ${PORT}`);
} else if (baseUrl.startsWith("https://")) {
  // Development: Use HTTPS if BASE_URL is https://
  createHttpsServer();
} else {
  // Development: Use HTTP
  createHttpServer();
}

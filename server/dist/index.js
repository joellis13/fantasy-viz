"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const parsers_1 = require("./parsers");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, BASE_URL = "http://localhost:5000", FRONTEND_URL = "http://localhost:3000", SESSION_SECRET = "dev-secret", SSL_CERT_PATH, SSL_KEY_PATH, } = process.env;
if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET) {
    console.warn("YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET are not set. Set them for OAuth to work.");
}
app.use((0, cookie_session_1.default)({
    name: "session",
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: BASE_URL.startsWith("https://"),
    sameSite: "lax",
}));
// Helper token store (POC). Replace with DB in production.
const tokenStore = new Map();
function buildYahooAuthUrl(state) {
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
    const state = crypto_1.default.randomBytes(32).toString("hex");
    req.session.oauthState = state;
    const url = buildYahooAuthUrl(state);
    console.log("Yahoo auth URL:", url);
    if (req.query.debug)
        return res.json({ url });
    res.redirect(url);
});
app.get("/auth/yahoo/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || req.session.oauthState !== state) {
        return res.status(400).send("Invalid OAuth state or missing code");
    }
    try {
        const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
        const data = qs_1.default.stringify({
            grant_type: "authorization_code",
            code: String(code),
            redirect_uri: `${BASE_URL}/auth/yahoo/callback`,
        });
        const authHeader = Buffer.from(`${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`).toString("base64");
        const tokenRes = await axios_1.default.post(tokenUrl, data, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${authHeader}`,
            },
        });
        const tokens = tokenRes.data;
        const userId = `user-${Math.random().toString(36).slice(2)}`;
        tokenStore.set(userId, tokens);
        req.session.userId = userId;
        res.redirect(`${FRONTEND_URL}`);
    }
    catch (err) {
        console.error("Token exchange error:", err.response?.data || err.message);
        res.status(500).send("OAuth token exchange failed");
    }
});
function getTokenForReq(req) {
    const uid = req.session.userId;
    if (!uid)
        return null;
    return tokenStore.get(uid) || null;
}
app.get("/api/league/:leagueKey", async (req, res) => {
    const token = getTokenForReq(req);
    if (!token)
        return res.status(401).json({ error: "not authenticated" });
    const leagueKey = req.params.leagueKey;
    try {
        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(leagueKey)}/standings?format=json`;
        console.log("Fetching league from Yahoo API:\n", yahooUrl);
        const resp = await axios_1.default.get(yahooUrl, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
            },
        });
        console.log("Raw league data:", JSON.stringify(resp.data, null, 2));
        const normalized = (0, parsers_1.normalizeLeague)(resp.data);
        res.json(normalized);
    }
    catch (err) {
        console.error("Error fetching league:", err.response?.data || err.message);
        res
            .status(500)
            .json({ error: "failed to fetch league", details: err.message });
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
    http_1.default.createServer(app).listen(PORT, () => {
        console.log(`HTTP server running at http://localhost:${PORT}`);
    });
}
function createHttpsServer(certPath, keyPath) {
    try {
        const certFile = certPath ||
            SSL_CERT_PATH ||
            path_1.default.join(process.cwd(), "certs", "localhost.pem");
        const keyFile = keyPath ||
            SSL_KEY_PATH ||
            path_1.default.join(process.cwd(), "certs", "localhost-key.pem");
        if (!fs_1.default.existsSync(certFile) || !fs_1.default.existsSync(keyFile)) {
            console.warn("HTTPS cert or key file not found.", { certFile, keyFile });
            console.warn("Falling back to HTTP. Generate certs (mkcert or OpenSSL) and set SSL_CERT_PATH/SSL_KEY_PATH in .env.");
            createHttpServer();
            return;
        }
        const options = {
            key: fs_1.default.readFileSync(keyFile),
            cert: fs_1.default.readFileSync(certFile),
        };
        https_1.default.createServer(options, app).listen(PORT, () => {
            console.log(`HTTPS server running at ${baseUrl}`);
        });
    }
    catch (err) {
        console.error("Failed to start HTTPS server, falling back to HTTP:", err);
        createHttpServer();
    }
}
if (baseUrl.startsWith("https://")) {
    createHttpsServer();
}
else {
    createHttpServer();
}

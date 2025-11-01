/**
 * Token Store with automatic refresh and file persistence
 *
 * Yahoo OAuth tokens:
 * - access_token: expires in 1 hour
 * - refresh_token: valid for multiple uses, expires after inactivity
 */

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import qs from "qs";

interface YahooTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds until expiration
  token_type: string;
  xoauth_yahoo_guid?: string;
}

interface StoredToken {
  tokens: YahooTokens;
  expiresAt: number; // timestamp when access_token expires
  userId: string;
}

class TokenStore {
  private tokens = new Map<string, StoredToken>();
  private readonly tokenFile = path.join(
    __dirname,
    "..",
    "cache",
    "tokens.json"
  );

  constructor() {
    this.loadFromFile();
  }

  /**
   * Load tokens from file (persists across server restarts)
   */
  private loadFromFile() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        const data = JSON.parse(fs.readFileSync(this.tokenFile, "utf-8"));

        // Convert array back to Map
        for (const [userId, stored] of Object.entries(data)) {
          this.tokens.set(userId, stored as StoredToken);
        }
      }
    } catch (error) {
      console.error("Failed to load tokens from file:", error);
    }
  }

  /**
   * Save tokens to file
   */
  private saveToFile() {
    try {
      const cacheDir = path.dirname(this.tokenFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Convert Map to object for JSON
      const data = Object.fromEntries(this.tokens.entries());
      fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save tokens to file:", error);
    }
  }

  /**
   * Store tokens for a user
   */
  setTokens(userId: string, tokens: YahooTokens) {
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    this.tokens.set(userId, {
      tokens,
      expiresAt,
      userId,
    });

    this.saveToFile();
  }

  /**
   * Get valid access token for a user (automatically refreshes if expired)
   */
  async getAccessToken(userId: string): Promise<string | null> {
    const stored = this.tokens.get(userId);

    if (!stored) {
      return null;
    }

    // Check if token is expired or expires soon (within 5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() + fiveMinutes < stored.expiresAt) {
      // Token is still valid
      return stored.tokens.access_token;
    }

    // Token expired or expiring soon - refresh it
    try {
      const newTokens = await this.refreshToken(stored.tokens.refresh_token);

      if (newTokens) {
        this.setTokens(userId, newTokens);
        return newTokens.access_token;
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
    }

    return null;
  }

  /**
   * Refresh an expired access token using the refresh token
   */
  private async refreshToken(
    refreshToken: string
  ): Promise<YahooTokens | null> {
    const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, BASE_URL } = process.env;

    if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET) {
      throw new Error("Yahoo OAuth credentials not configured");
    }

    try {
      const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
      const data = qs.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        redirect_uri: `${BASE_URL}/auth/yahoo/callback`,
      });

      const authHeader = Buffer.from(
        `${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`
      ).toString("base64");

      const response = await axios.post(tokenUrl, data, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "Token refresh failed:",
        error.response?.data || error.message
      );
      return null;
    }
  }

  /**
   * Get full token object (for debugging)
   */
  getTokens(userId: string): YahooTokens | null {
    const stored = this.tokens.get(userId);
    return stored ? stored.tokens : null;
  }

  /**
   * Remove tokens for a user (logout)
   */
  removeTokens(userId: string) {
    this.tokens.delete(userId);
    this.saveToFile();
  }

  /**
   * Check if user has valid tokens
   */
  hasTokens(userId: string): boolean {
    return this.tokens.has(userId);
  }
}

// Singleton instance
export const tokenStore = new TokenStore();

// Legacy compatibility exports
export function setTokenForUserId(userId: string, tokens: YahooTokens) {
  tokenStore.setTokens(userId, tokens);
}

export async function getTokenForUserId(
  userId: string
): Promise<{ access_token: string } | null> {
  const accessToken = await tokenStore.getAccessToken(userId);
  return accessToken ? { access_token: accessToken } : null;
}

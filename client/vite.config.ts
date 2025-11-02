import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// Check if we're in production or if certs exist
const certKeyPath = path.resolve(
  __dirname,
  "../server/certs/localhost-key.pem"
);
const certPath = path.resolve(__dirname, "../server/certs/localhost.pem");
const useHttps =
  process.env.NODE_ENV !== "production" &&
  fs.existsSync(certKeyPath) &&
  fs.existsSync(certPath);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    ...(useHttps && {
      https: {
        key: fs.readFileSync(certKeyPath),
        cert: fs.readFileSync(certPath),
      },
    }),
    proxy: {
      "/auth": {
        target: useHttps ? "https://localhost:5000" : "http://localhost:5000",
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
      },
      "/api": {
        target: useHttps ? "https://localhost:5000" : "http://localhost:5000",
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    https: {
      key: fs.readFileSync(
        path.resolve(__dirname, "../server/certs/localhost-key.pem")
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "../server/certs/localhost.pem")
      ),
    },
    proxy: {
      "/auth": {
        target: "https://localhost:5000",
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
      },
      "/api": {
        target: "https://localhost:5000",
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
      },
    },
  },
});

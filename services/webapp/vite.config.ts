import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_TARGET ?? "http://videoai.localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEBAPP_PORT ?? 5173),
    allowedHosts: ["videoai.localhost"],
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.WEBAPP_PORT ?? 5173)
  }
});

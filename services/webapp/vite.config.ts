import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEBAPP_PORT ?? 5173),
    allowedHosts: ["videoai.localhost"]
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.WEBAPP_PORT ?? 5173)
  }
});

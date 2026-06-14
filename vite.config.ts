import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __ARCHIVEOS_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __ARCHIVEOS_COMMIT_SHA__: JSON.stringify(process.env.VITE_COMMIT_SHA ?? ""),
    __ARCHIVEOS_FRONTEND_VERSION__: JSON.stringify(process.env.npm_package_version ?? ""),
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
    },
  },
});

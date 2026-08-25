import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The OCI edge serves the public console below /archiveos/. Local Docker
  // continues to use the root path unless the release build opts in.
  base: process.env.VITE_PUBLIC_BASE ?? "/",
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
      "/api/security/access": "http://127.0.0.1:4100",
      "/api": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
    },
  },
});

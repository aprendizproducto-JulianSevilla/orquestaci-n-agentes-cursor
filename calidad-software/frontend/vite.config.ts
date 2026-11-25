import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@contratos": fileURLToPath(new URL("../bot/lib/contratos.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/agent": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:3000" },
        rewrite: (path) => path.replace(/^\/agent/, "/calidad-software"),
      },
    },
  },
});

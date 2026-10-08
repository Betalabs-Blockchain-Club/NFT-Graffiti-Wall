import { defineConfig } from "vite";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/mock": "http://127.0.0.1:3001"
    }
  }
});

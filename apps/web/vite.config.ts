import { ANVIL_HOST_PORT, ANVIL_WEB_PORT, ANVIL_WS_PATH } from "@anvil/protocol";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: ANVIL_WEB_PORT,
    strictPort: true,
    proxy: {
      "/health": `http://127.0.0.1:${ANVIL_HOST_PORT}`,
      [ANVIL_WS_PATH]: {
        target: `ws://127.0.0.1:${ANVIL_HOST_PORT}`,
        ws: true,
      },
    },
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const bridgePort = Number(process.env.BRIDGE_PORT ?? 8787);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/bridge": `http://127.0.0.1:${bridgePort}` },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});

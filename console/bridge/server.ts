import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createBridgeApp, type ToolClient } from "./app";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.BRIDGE_PORT ?? 8787);
const apiUrl = process.env.ORDER_API_URL ?? "http://localhost:8080/api";
const serverPath = resolve(process.env.MCP_SERVER_PATH ?? resolve(here, "../../mcp-server/dist/index.js"));

if (!existsSync(serverPath)) {
  console.error(`[bridge] MCP server not found at ${serverPath}. Run "npm run build" in mcp-server/ first.`);
}

/** One long-lived MCP client over stdio, spawned lazily and respawned if the child dies. */
let connecting: Promise<Client> | null = null;

function getClient(): Promise<ToolClient> {
  if (!connecting) {
    connecting = (async () => {
      const client = new Client({ name: "mcp-console-bridge", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverPath],
        env: { ...process.env, ORDER_API_URL: apiUrl } as Record<string, string>,
        stderr: "inherit",
      });
      client.onclose = () => {
        connecting = null;
      };
      await client.connect(transport);
      console.log(`[bridge] connected to ${client.getServerVersion()?.name} over stdio (API: ${apiUrl})`);
      return client;
    })().catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting as Promise<ToolClient>;
}

const app = createBridgeApp({
  getClient,
  apiUrl,
  onConnectionLost: () => {
    connecting = null;
  },
});

const httpServer = app.listen(port, "127.0.0.1", () => {
  console.log(`[bridge] listening on http://127.0.0.1:${port}`);
  getClient().catch((err) => console.error(`[bridge] first connection failed: ${(err as Error).message}`));
});

async function shutdown() {
  httpServer.close();
  const pending = connecting;
  connecting = null;
  if (pending) await pending.then((c) => c.close()).catch(() => undefined);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

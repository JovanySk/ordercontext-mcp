import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * End-to-end over the real MCP protocol: spawns the built server (dist/index.js) through stdio,
 * pointed at a tiny fake REST API, exactly like Claude Desktop or any MCP client would.
 */
let api: Server;
let client: Client;

beforeAll(async () => {
  api = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/products/low-stock") {
      res.end(JSON.stringify([{ id: 3, sku: "HAR-TRI", name: "Harina de trigo 25kg", category: "Insumos", price: 520, stock: 2, minStock: 5 }]));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const port = (api.address() as { port: number }).port;

  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    env: { ...process.env, ORDER_API_URL: `http://127.0.0.1:${port}/api` } as Record<string, string>,
    stderr: "ignore",
  }));
}, 20_000);

afterAll(async () => {
  await client?.close();
  api?.close();
});

describe("MCP protocol", () => {
  it("exposes exactly the 5 read-only tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "generate_order_context", "get_customer_summary", "get_low_stock_products", "get_order_by_id", "list_pending_orders",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("calls a tool end to end", async () => {
    const res = await client.callTool({ name: "get_low_stock_products", arguments: {} });
    const text = (res.content as { text: string }[])[0].text;
    expect(JSON.parse(text)[0].sku).toBe("HAR-TRI");
  });

  it("rejects invalid arguments through schema validation", async () => {
    const res = await client.callTool({ name: "get_order_by_id", arguments: { orderId: -5 } });
    expect(res.isError).toBe(true);
  });

  it("returns a tool error for a missing order", async () => {
    const res = await client.callTool({ name: "get_order_by_id", arguments: { orderId: 999 } });
    expect(res.isError).toBe(true);
    expect((res.content as { text: string }[])[0].text).toContain("404");
  });
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const c = new Client({ name: "demo", version: "1.0.0" });
await c.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], env: { ...process.env, ORDER_API_URL: "http://localhost:8080/api" }, stderr: "ignore" }));
const show = async (name, args) => { const r = await c.callTool({ name, arguments: args }); console.log(`\n### ${name} ${JSON.stringify(args)}\n` + r.content[0].text.slice(0, 700)); };
await show("generate_order_context", { orderId: 10 });
await show("get_low_stock_products", {});
await show("list_pending_orders", { limit: 3 });
await c.close();

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiError, type OrderApiClient, type OrderContext } from "./apiClient.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

const fail = (err: unknown): ToolResult => ({
  isError: true,
  content: [{ type: "text", text: err instanceof ApiError ? `Error ${err.status}: ${err.message}` : "Unexpected error" }],
});

const id = z.number().int().positive();

/** Same behaviour for every tool: call the API, return JSON text, turn failures into readable tool errors. */
async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

const money = (n: number) => `$${n.toFixed(2)} MXN`;

/** Turns /orders/{id}/context into a compact brief an LLM can reason over. */
export function formatOrderContext(ctx: OrderContext): string {
  const { order, customer, customerStats, stockWarnings, daysUntilDelivery } = ctx;
  const when =
    daysUntilDelivery < 0 ? `${-daysUntilDelivery} day(s) overdue`
    : daysUntilDelivery === 0 ? "today"
    : `in ${daysUntilDelivery} day(s)`;
  const lines = [
    `# Order #${order.id} (${order.status})`,
    `Customer: ${customer.name} (${customer.email}, ${customer.phone}): ${customerStats.totalOrders} orders, ${money(customerStats.totalSpent)} spent`,
    `Delivery: ${order.deliveryDate} (${when})`,
    "",
    "## Items",
    ...order.items.map((i) => `- ${i.quantity} × ${i.productName} [${i.sku}] @ ${money(i.unitPrice)} = ${money(i.subtotal)}`),
    `Total: ${money(order.total)}`,
  ];
  if (order.notes) lines.push("", `Notes: ${order.notes}`);
  lines.push("", "## Stock warnings");
  lines.push(
    ...(stockWarnings.length
      ? stockWarnings.map((w) => `- ${w.productName} [${w.sku}]: requested ${w.requested}, available ${w.available}`)
      : ["- None"]),
  );
  return lines.join("\n");
}

/** Handlers are exported separately so they can be unit-tested without a transport. */
export function createHandlers(api: OrderApiClient) {
  return {
    get_order_by_id: ({ orderId }: { orderId: number }) => run(() => api.getOrder(orderId)),
    list_pending_orders: ({ limit }: { limit?: number }) => run(() => api.listPendingOrders(limit ?? 20)),
    get_customer_summary: ({ customerId }: { customerId: number }) => run(() => api.getCustomerSummary(customerId)),
    get_low_stock_products: () => run(() => api.getLowStockProducts()),
    generate_order_context: ({ orderId }: { orderId: number }) =>
      run(async () => formatOrderContext(await api.getOrderContext(orderId))),
  };
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerTools(server: McpServer, api: OrderApiClient) {
  const h = createHandlers(api);

  server.registerTool(
    "get_order_by_id",
    {
      title: "Get order",
      description: "Returns one bakery order with its items, status, delivery date and total.",
      inputSchema: { orderId: id.describe("Order id") },
      annotations: readOnly,
    },
    h.get_order_by_id,
  );

  server.registerTool(
    "list_pending_orders",
    {
      title: "List pending orders",
      description: "Orders not yet delivered or cancelled (PENDING, CONFIRMED, IN_PREPARATION), soonest delivery first.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional().describe("Max orders to return (1-100, default 20)") },
      annotations: readOnly,
    },
    h.list_pending_orders,
  );

  server.registerTool(
    "get_customer_summary",
    {
      title: "Customer summary",
      description: "Customer profile with total orders, total spent, orders by status and the 5 most recent orders.",
      inputSchema: { customerId: id.describe("Customer id") },
      annotations: readOnly,
    },
    h.get_customer_summary,
  );

  server.registerTool(
    "get_low_stock_products",
    {
      title: "Low-stock products",
      description: "Products whose stock is at or below their minimum, most critical first.",
      inputSchema: {},
      annotations: readOnly,
    },
    h.get_low_stock_products,
  );

  server.registerTool(
    "generate_order_context",
    {
      title: "Order context brief",
      description:
        "Builds a concise brief for one order (customer history, items, total, days until delivery and stock warnings) to answer questions or draft a message to the customer.",
      inputSchema: { orderId: id.describe("Order id") },
      annotations: readOnly,
    },
    h.generate_order_context,
  );
}

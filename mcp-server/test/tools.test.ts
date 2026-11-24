import { describe, expect, it, vi } from "vitest";
import { ApiError, OrderApiClient, type FetchLike, type OrderContext } from "../src/apiClient.js";
import { createHandlers, formatOrderContext } from "../src/tools.js";

const order = {
  id: 7, customerId: 2, customerName: "Ana Torres", status: "CONFIRMED",
  createdAt: "2026-11-20T10:00:00Z", deliveryDate: "2026-11-26", notes: "Sin nuez",
  items: [{ productId: 1, sku: "PAS-CHO", productName: "Pastel de chocolate", quantity: 2, unitPrice: 450, subtotal: 900 }],
  total: 900,
};

const context: OrderContext = {
  order,
  customer: { id: 2, name: "Ana Torres", email: "ana@example.com", phone: "555-0102" },
  customerStats: { totalOrders: 4, totalSpent: 2350 },
  stockWarnings: [{ sku: "PAS-CHO", productName: "Pastel de chocolate", requested: 2, available: 1 }],
  daysUntilDelivery: 2,
};

/** fetch stub that answers by path and records the URLs it was called with */
function stubFetch(routes: Record<string, { status?: number; body?: unknown }>) {
  const calls: string[] = [];
  const fn: FetchLike = async (url) => {
    calls.push(url);
    const path = url.replace("http://api.test/api", "");
    const r = routes[path];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body };
  };
  return { fn, calls };
}

const client = (routes: Parameters<typeof stubFetch>[0]) => {
  const s = stubFetch(routes);
  return { api: new OrderApiClient("http://api.test/api", s.fn), calls: s.calls };
};

describe("OrderApiClient", () => {
  it("calls the contract paths", async () => {
    const { api, calls } = client({
      "/orders/7": { body: order },
      "/orders/pending?limit=5": { body: [order] },
      "/customers/2/summary": { body: {} },
      "/products/low-stock": { body: [] },
      "/orders/7/context": { body: context },
    });
    await api.getOrder(7);
    await api.listPendingOrders(5);
    await api.getCustomerSummary(2);
    await api.getLowStockProducts();
    await api.getOrderContext(7);
    expect(calls).toEqual([
      "http://api.test/api/orders/7",
      "http://api.test/api/orders/pending?limit=5",
      "http://api.test/api/customers/2/summary",
      "http://api.test/api/products/low-stock",
      "http://api.test/api/orders/7/context",
    ]);
  });

  it("maps 404 to ApiError(404)", async () => {
    const { api } = client({});
    await expect(api.getOrder(99)).rejects.toMatchObject({ status: 404 });
  });

  it("maps server errors to ApiError with the HTTP status", async () => {
    const { api } = client({ "/products/low-stock": { status: 500 } });
    await expect(api.getLowStockProducts()).rejects.toMatchObject({ status: 500 });
  });

  it("reports an unreachable API as 503", async () => {
    const api = new OrderApiClient("http://api.test/api", async () => { throw new TypeError("fetch failed"); });
    const err = await api.getOrder(1).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.message).toContain("not reachable");
  });

  it("times out slow responses", async () => {
    vi.useFakeTimers();
    const api = new OrderApiClient("http://api.test/api", (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })))), 1000);
    const pending = api.getOrder(1).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1001);
    const err = await pending;
    vi.useRealTimers();
    expect(err.status).toBe(503);
    expect(err.message).toContain("timed out");
  });
});

describe("tool handlers", () => {
  it("get_order_by_id returns the order as JSON text", async () => {
    const h = createHandlers(client({ "/orders/7": { body: order } }).api);
    const res = await h.get_order_by_id({ orderId: 7 });
    expect(res.isError).toBeUndefined();
    expect(JSON.parse(res.content[0].text).id).toBe(7);
  });

  it("list_pending_orders defaults to limit 20", async () => {
    const { api, calls } = client({ "/orders/pending?limit=20": { body: [] } });
    await createHandlers(api).list_pending_orders({});
    expect(calls[0]).toContain("limit=20");
  });

  it("returns a readable tool error instead of throwing", async () => {
    const h = createHandlers(client({}).api);
    const res = await h.get_customer_summary({ customerId: 404 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("Error 404: Resource not found");
  });

  it("generate_order_context returns a markdown brief", async () => {
    const h = createHandlers(client({ "/orders/7/context": { body: context } }).api);
    const text = (await h.generate_order_context({ orderId: 7 })).content[0].text;
    expect(text).toContain("# Order #7 (CONFIRMED)");
    expect(text).toContain("in 2 day(s)");
    expect(text).toContain("2 × Pastel de chocolate [PAS-CHO] @ $450.00 MXN = $900.00 MXN");
    expect(text).toContain("requested 2, available 1");
    expect(text).toContain("Notes: Sin nuez");
  });
});

describe("formatOrderContext", () => {
  it("handles overdue orders and no warnings", () => {
    const text = formatOrderContext({ ...context, daysUntilDelivery: -3, stockWarnings: [] });
    expect(text).toContain("3 day(s) overdue");
    expect(text).toContain("- None");
  });

  it("says today for same-day delivery", () => {
    expect(formatOrderContext({ ...context, daysUntilDelivery: 0 })).toContain("(today)");
  });
});

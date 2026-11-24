/**
 * Minimal read-only HTTP client for the OrderContext REST API.
 * The MCP server never talks to the database: every tool goes through these GET calls.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface OrderItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customerId: number;
  customerName: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  notes?: string | null;
  items: OrderItem[];
  total: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
}

export interface CustomerSummary {
  customer: Customer;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  ordersByStatus: Record<string, number>;
  recentOrders: Order[];
}

export interface OrderContext {
  order: Order;
  customer: Customer;
  customerStats: { totalOrders: number; totalSpent: number };
  stockWarnings: { sku: string; productName: string; requested: number; available: number }[];
  daysUntilDelivery: number;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class OrderApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 5000,
  ) {}

  getOrder(id: number) {
    return this.get<Order>(`/orders/${id}`);
  }

  listPendingOrders(limit: number) {
    return this.get<Order[]>(`/orders/pending?limit=${limit}`);
  }

  getCustomerSummary(id: number) {
    return this.get<CustomerSummary>(`/customers/${id}/summary`);
  }

  getLowStockProducts() {
    return this.get<Product[]>(`/products/low-stock`);
  }

  getOrderContext(id: number) {
    return this.get<OrderContext>(`/orders/${id}/context`);
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.baseUrl.replace(/\/$/, "") + path, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) throw new ApiError("Resource not found", 404);
      if (!res.ok) throw new ApiError(`API responded with HTTP ${res.status}`, res.status);
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const reason = (err as Error).name === "AbortError" ? "timed out" : "is not reachable";
      throw new ApiError(`The orders API ${reason} at ${this.baseUrl}`, 503);
    } finally {
      clearTimeout(timer);
    }
  }
}

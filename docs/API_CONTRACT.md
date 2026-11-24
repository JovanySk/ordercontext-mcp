# OrderContext — API contract (v1)

Base URL: `http://localhost:8080/api`. JSON only. Errors: `{"status":404,"error":"Not Found","message":"...","path":"..."}`.
Money is a JSON number with 2 decimals (MXN). Dates are ISO-8601 (`2026-11-24T10:00:00Z` / `2026-11-26`).

## Domain
- **Customer** `{ id, name, email, phone }`
- **Product** `{ id, sku, name, category, price, stock, minStock }`; low stock means `stock <= minStock`.
- **Order** `{ id, customerId, customerName, status, createdAt, deliveryDate, notes, items:[OrderItem], total }`
  - status ∈ `PENDING | CONFIRMED | IN_PREPARATION | DELIVERED | CANCELLED`
- **OrderItem** `{ productId, sku, productName, quantity, unitPrice, subtotal }`

## Read endpoints (used by the MCP server, all read-only)
| Method | Path | Returns |
|---|---|---|
| GET | `/orders/{id}` | Order (404 if missing) |
| GET | `/orders/pending?limit=20` | Order[]: status PENDING, CONFIRMED or IN_PREPARATION, sorted by deliveryDate asc; `limit` 1–100 (default 20) |
| GET | `/customers/{id}/summary` | `{ customer, totalOrders, totalSpent, lastOrderAt, ordersByStatus:{STATUS:count}, recentOrders:[Order max 5] }` |
| GET | `/products/low-stock` | Product[] with stock <= minStock, sorted by (stock - minStock) asc |
| GET | `/orders/{id}/context` | `{ order, customer, customerStats:{totalOrders,totalSpent}, stockWarnings:[{sku,productName,requested,available}], daysUntilDelivery }` |

## Write endpoints (API only, NOT exposed to the AI)
| Method | Path | Body | Rules |
|---|---|---|---|
| POST | `/orders` | `{ customerId, deliveryDate, notes?, items:[{productId, quantity}] }` | ≥1 item; quantity 1–100; deliveryDate not in the past; customer/products must exist; stock is reserved (decremented); insufficient stock → 409. 201 + Order |
| PATCH | `/orders/{id}/status` | `{ status }` | Allowed: PENDING→CONFIRMED→IN_PREPARATION→DELIVERED; PENDING/CONFIRMED→CANCELLED (restocks items). Invalid transition → 409 |
| GET | `/customers`, `/products` | — | lists |

Seed data: a bakery ("Pastelería"): 5 customers, 10 products (cakes, cupcakes, bread, supplies), ~12 orders in mixed statuses, 3 products in low stock.

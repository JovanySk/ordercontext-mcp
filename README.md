# OrderContext: an AI assistant over a Java orders API (MCP)

This project connects an AI assistant (Claude Desktop or any MCP client) to a **Spring Boot orders API** for a bakery. It does it through a **read-only Model Context Protocol server** written in TypeScript: the model can look up orders, customers and stock, but it never touches the database or changes anything.

[![CI](https://github.com/JovanySk/ordercontext-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/JovanySk/ordercontext-mcp/actions/workflows/ci.yml) ![Java](https://img.shields.io/badge/Java-17-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-brightgreen) ![MCP](https://img.shields.io/badge/MCP-TypeScript%20SDK-black) ![Tests](https://img.shields.io/badge/tests-72%20JUnit%20%2B%2015%20Vitest-success)

```text
User ─► AI assistant ─► MCP server (Node/TS, stdio) ──GET──► Spring Boot REST API ─► JPA ─► H2 / MySQL
                         5 typed read-only tools        Controller → Service → Repository
```

## MCP tools

| Tool | Input | What the assistant gets |
|---|---|---|
| `get_order_by_id` | `orderId` | Order with items, status, delivery date and total |
| `list_pending_orders` | `limit?` (1–100) | Undelivered orders, soonest first |
| `get_customer_summary` | `customerId` | Profile, totals, orders by status, the 5 latest orders |
| `get_low_stock_products` | — | Products at or below their minimum stock |
| `generate_order_context` | `orderId` | A Markdown brief: customer history, items, days to delivery, **stock warnings** |

Every tool:
- **validates its input with a zod schema**;
- is marked `readOnlyHint`;
- has a 5 s timeout;
- returns readable tool errors (404, API down) instead of crashing.

Write operations (creating orders, changing status) exist only in the REST API and are **deliberately not exposed to the AI**.

Real output against the seed data is in [`docs/demo-output.md`](docs/demo-output.md). For example:

```text
# Order #10 (PENDING)
Customer: Ana Torres (...): 3 orders, $2205.00 MXN spent
Delivery: 2026-11-29 (in 5 day(s))
- 3 × Pastel de tres leches [CAKE-3LCH] @ $420.00 MXN = $1260.00 MXN
## Stock warnings
- Pastel de tres leches [CAKE-3LCH]: requested 3, available 2
```

## Orders API (`api/`)

Java 17, Spring Boot 3.5, Spring Data JPA, Bean Validation and springdoc (Swagger UI at `/swagger-ui.html`).

- **Business rules:**
  - creating an order reserves stock, and insufficient stock returns **409**;
  - quantity must be 1–100 and the delivery date can't be in the past;
  - status follows a state machine (`PENDING → CONFIRMED → IN_PREPARATION → DELIVERED`), and cancelling restocks the items;
  - optimistic locking on products.
- **Tests:** 72 JUnit 5 runs:
  - service rules with Mockito and a fixed clock, including every valid and invalid status transition;
  - `@WebMvcTest` controllers;
  - `@SpringBootTest` integration tests on seed data.
- **Contract:** [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## MCP server (`mcp-server/`)

TypeScript with the official `@modelcontextprotocol/sdk`. **15 Vitest tests**, including an **end-to-end protocol test**: it spawns the built server over stdio and checks the tool list, a real tool call, schema rejection and the 404 handling.

## Run it

```bash
# 1. API (H2 in memory with seed data) on http://localhost:8080
cd api && ./mvnw spring-boot:run          # or: docker compose up  (MySQL)

# 2. MCP server
cd mcp-server && npm ci && npm run build
node scripts/demo.mjs                     # calls the tools against the running API
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ordercontext": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": { "ORDER_API_URL": "http://localhost:8080/api" }
    }
  }
}
```

Then ask things like: *"Which pending orders are at risk because of stock?"* or *"Summarize Ana Torres's order 10 and draft a message to her."*

---
Author: **Jovany Morales del Ángel** · MIT License

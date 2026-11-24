# OrderContext API

REST API for a local bakery ("Pastelería"): customers, products and orders.
Java 17 · Spring Boot 3.5 · Spring Data JPA · H2 / MySQL · JUnit 5 + Mockito · Swagger/OpenAPI.

Contract: [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md).

## Run

Default profile uses an in-memory H2 database and loads demo data (5 customers, 10 products, 12 orders).

```bash
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

- API: http://localhost:8080/api
- Swagger UI: http://localhost:8080/swagger-ui.html
- H2 console: http://localhost:8080/h2-console (JDBC URL `jdbc:h2:mem:ordercontext`, user `sa`)

### MySQL

Credentials come only from environment variables:

```bash
export DB_URL=jdbc:mysql://localhost:3306/ordercontext
export DB_USERNAME=...
export DB_PASSWORD=...
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

The schema is created/updated by Hibernate and the demo data is loaded only when the database is empty
(`app.seed.enabled=false` disables it).

### Docker

```bash
docker build -t ordercontext-api .
docker run -p 8080:8080 ordercontext-api
```

## Endpoints

Base path `/api`. Errors: `{"status":404,"error":"Not Found","message":"...","path":"..."}`.

| Method | Path | Description |
|---|---|---|
| GET | `/orders/{id}` | One order (404 if missing) |
| GET | `/orders/pending?limit=20` | PENDING / CONFIRMED / IN_PREPARATION orders, closest delivery first (`limit` 1–100) |
| GET | `/orders/{id}/context` | Order + customer + customer stats + stock warnings + days until delivery |
| GET | `/customers/{id}/summary` | Totals, orders by status and 5 most recent orders |
| GET | `/products/low-stock` | Products with `stock <= minStock`, most critical first |
| GET | `/customers`, `/products` | Lists |
| POST | `/orders` | Create order (201). Reserves stock, 409 if not enough |
| PATCH | `/orders/{id}/status` | Change status. Invalid transition → 409. Cancelling restocks |

Business rules:
- An order needs at least 1 item, each quantity between 1 and 100, and a delivery date that is not in the past (400).
- Status flow: `PENDING → CONFIRMED → IN_PREPARATION → DELIVERED`; `PENDING` / `CONFIRMED → CANCELLED`.
- `totalSpent` excludes cancelled orders; `totalOrders` counts all of them.
- A stock warning is produced for items of active orders whose product is in low stock or has less stock
  than the requested quantity.
- "Today" is calculated in the `America/Mexico_City` time zone (`app.time-zone`).

## Project structure

```
com.ordercontext
├── customer   Customer entity, repository, service, controller, DTOs
├── product    Product entity, repository, service, controller, DTOs
├── order      Order/OrderItem entities, OrderStatus rules, service, controller, DTOs
└── common     Error handling (@RestControllerAdvice), Clock, OpenAPI config, demo data seeder
```

## Tests

```bash
./mvnw verify                   # Windows: mvnw.cmd verify
```

- `OrderServiceTest` – unit tests with Mockito (stock reservation, validations, every status transition, restock, totals, context).
- `*ControllerTest` – `@WebMvcTest` tests for status codes and JSON shape of each read endpoint.
- `OrderContextApiIntegrationTest` – `@SpringBootTest` against H2 with the demo data.

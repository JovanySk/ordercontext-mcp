# Demo: MCP tools against the real API (seed data)

```text

### generate_order_context {"orderId":10}
# Order #10 (PENDING)
Customer: Ana Torres (ana.torres@example.com, 55 1000 0001): 3 orders, $2205.00 MXN spent
Delivery: 2026-11-29 (in 5 day(s))

## Items
- 3 × Pastel de tres leches [CAKE-3LCH] @ $420.00 MXN = $1260.00 MXN
Total: $1260.00 MXN

Notes: Para la fiesta de la oficina

## Stock warnings
- Pastel de tres leches [CAKE-3LCH]: requested 3, available 2

### get_low_stock_products {}
[
  {
    "id": 5,
    "sku": "CUP-RDVL",
    "name": "Cupcake red velvet",
    "category": "CUPCAKE",
    "price": 40,
    "stock": 10,
    "minStock": 12
  },
  {
    "id": 2,
    "sku": "CAKE-3LCH",
    "name": "Pastel de tres leches",
    "category": "CAKE",
    "price": 420,
    "stock": 2,
    "minStock": 3
  },
  {
    "id": 8,
    "sku": "BREAD-CUERNO",
    "name": "Cuernito de mantequilla",
    "category": "BREAD",
    "price": 18,
    "stock": 25,
    "minStock": 25
  }
]

### list_pending_orders {"limit":3}
[
  {
    "id": 5,
    "customerId": 1,
    "customerName": "Ana Torres",
    "status": "IN_PREPARATION",
    "createdAt": "2026-11-20T16:00:00Z",
    "deliveryDate": "2026-11-24",
    "notes": "Escribir 'Feliz cumpleaños, Sofi'",
    "items": [
      {
        "productId": 2,
        "sku": "CAKE-3LCH",
        "productName": "Pastel de tres leches",
        "quantity": 1,
        "unitPrice": 420,
        "subtotal": 420
      },
      {
        "productId": 9,
        "sku": "SUP-VELAS",
        "productName": "Velas de cumpleaños (paquete)",
        "quantity": 2,
        "unitPrice": 25,
        "subtotal": 50
      }
    ],
    "total": 470
  },
  {
    "id": 6,
    "customerId": 5,
  
```

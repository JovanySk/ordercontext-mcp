package com.ordercontext.order;

/** A product of an active order whose current stock is low or below the requested quantity. */
public record StockWarning(String sku, String productName, int requested, int available) {
}

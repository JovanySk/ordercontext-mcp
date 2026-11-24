package com.ordercontext.common;

/**
 * Error body returned by every endpoint, e.g.
 * {"status":404,"error":"Not Found","message":"...","path":"/api/orders/99"}
 */
public record ApiError(int status, String error, String message, String path) {
}

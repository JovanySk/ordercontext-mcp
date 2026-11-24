package com.ordercontext.customer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.ordercontext.order.OrderResponse;
import com.ordercontext.order.OrderStatus;

/**
 * Response of GET /api/customers/{id}/summary.
 * ordersByStatus always contains every status (0 when there are none).
 */
public record CustomerSummaryResponse(
        CustomerResponse customer,
        long totalOrders,
        BigDecimal totalSpent,
        Instant lastOrderAt,
        Map<OrderStatus, Long> ordersByStatus,
        List<OrderResponse> recentOrders) {
}

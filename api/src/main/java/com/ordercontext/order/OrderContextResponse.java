package com.ordercontext.order;

import java.util.List;

import com.ordercontext.customer.CustomerResponse;
import com.ordercontext.customer.CustomerStats;

/**
 * Response of GET /api/orders/{id}/context: everything needed to talk about one order.
 * daysUntilDelivery is negative when the delivery date already passed.
 */
public record OrderContextResponse(
        OrderResponse order,
        CustomerResponse customer,
        CustomerStats customerStats,
        List<StockWarning> stockWarnings,
        long daysUntilDelivery) {
}

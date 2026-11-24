package com.ordercontext.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record OrderResponse(
        Long id,
        Long customerId,
        String customerName,
        OrderStatus status,
        Instant createdAt,
        LocalDate deliveryDate,
        String notes,
        List<OrderItemResponse> items,
        BigDecimal total) {

    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getCustomer().getId(),
                order.getCustomer().getName(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getDeliveryDate(),
                order.getNotes(),
                order.getItems().stream().map(OrderItemResponse::from).toList(),
                order.getTotal());
    }
}

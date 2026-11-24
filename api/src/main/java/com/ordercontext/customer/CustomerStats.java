package com.ordercontext.customer;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import com.ordercontext.order.Order;
import com.ordercontext.order.OrderStatus;

/**
 * Basic purchase statistics of a customer.
 * totalOrders counts every order; totalSpent ignores CANCELLED orders (they were never paid).
 */
public record CustomerStats(long totalOrders, BigDecimal totalSpent) {

    public static CustomerStats of(List<Order> orders) {
        BigDecimal spent = orders.stream()
                .filter(order -> order.getStatus() != OrderStatus.CANCELLED)
                .map(Order::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        return new CustomerStats(orders.size(), spent);
    }
}

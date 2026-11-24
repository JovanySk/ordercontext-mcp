package com.ordercontext.order;

/**
 * Life cycle of an order:
 * PENDING -> CONFIRMED -> IN_PREPARATION -> DELIVERED, and PENDING/CONFIRMED -> CANCELLED.
 */
public enum OrderStatus {
    PENDING,
    CONFIRMED,
    IN_PREPARATION,
    DELIVERED,
    CANCELLED;

    public boolean canTransitionTo(OrderStatus target) {
        return switch (this) {
            case PENDING -> target == CONFIRMED || target == CANCELLED;
            case CONFIRMED -> target == IN_PREPARATION || target == CANCELLED;
            case IN_PREPARATION -> target == DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };
    }

    /** Orders that still have to be prepared or delivered. */
    public boolean isActive() {
        return this == PENDING || this == CONFIRMED || this == IN_PREPARATION;
    }
}

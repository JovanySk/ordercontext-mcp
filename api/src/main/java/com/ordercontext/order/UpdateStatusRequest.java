package com.ordercontext.order;

import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "es obligatorio")
        OrderStatus status) {
}

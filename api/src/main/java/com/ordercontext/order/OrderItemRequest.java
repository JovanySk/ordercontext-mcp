package com.ordercontext.order;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OrderItemRequest(
        @NotNull(message = "es obligatorio")
        Long productId,

        @NotNull(message = "es obligatoria")
        @Min(value = OrderService.MIN_QUANTITY, message = "debe ser al menos 1")
        @Max(value = OrderService.MAX_QUANTITY, message = "no puede ser mayor a 100")
        Integer quantity) {
}

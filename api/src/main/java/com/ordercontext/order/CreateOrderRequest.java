package com.ordercontext.order;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of POST /api/orders. "Not in the past" is checked in OrderService (it needs the clock). */
public record CreateOrderRequest(
        @NotNull(message = "es obligatorio")
        Long customerId,

        @NotNull(message = "es obligatoria")
        LocalDate deliveryDate,

        @Size(max = 500, message = "no puede superar 500 caracteres")
        String notes,

        @NotEmpty(message = "debe contener al menos un producto")
        List<@Valid @NotNull(message = "no puede ser nulo") OrderItemRequest> items) {
}

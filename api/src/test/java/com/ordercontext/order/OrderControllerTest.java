package com.ordercontext.order;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.ordercontext.common.BusinessRuleException;
import com.ordercontext.common.ResourceNotFoundException;
import com.ordercontext.customer.CustomerResponse;
import com.ordercontext.customer.CustomerStats;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrderService orderService;

    static OrderResponse sampleOrder() {
        return new OrderResponse(7L, 1L, "Ana Torres", OrderStatus.PENDING,
                Instant.parse("2026-11-24T10:00:00Z"), LocalDate.of(2026, 11, 26), "Sin nueces",
                List.of(new OrderItemResponse(2L, "CAKE-3LCH", "Pastel de tres leches", 3,
                        new BigDecimal("420.00"), new BigDecimal("1260.00"))),
                new BigDecimal("1260.00"));
    }

    // ---------- GET /api/orders/{id} ----------

    @Test
    void getOrderReturnsContractShape() throws Exception {
        when(orderService.findById(7L)).thenReturn(sampleOrder());

        mockMvc.perform(get("/api/orders/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.customerId").value(1))
                .andExpect(jsonPath("$.customerName").value("Ana Torres"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.createdAt").value("2026-11-24T10:00:00Z"))
                .andExpect(jsonPath("$.deliveryDate").value("2026-11-26"))
                .andExpect(jsonPath("$.notes").value("Sin nueces"))
                .andExpect(jsonPath("$.items[0].productId").value(2))
                .andExpect(jsonPath("$.items[0].sku").value("CAKE-3LCH"))
                .andExpect(jsonPath("$.items[0].productName").value("Pastel de tres leches"))
                .andExpect(jsonPath("$.items[0].quantity").value(3))
                .andExpect(jsonPath("$.items[0].unitPrice").value(420.00))
                .andExpect(jsonPath("$.items[0].subtotal").value(1260.00))
                // money is a JSON number with 2 decimals
                .andExpect(content().string(containsString("\"total\":1260.00")));
    }

    @Test
    void getOrderReturns404WithErrorShape() throws Exception {
        when(orderService.findById(99L)).thenThrow(new ResourceNotFoundException("Pedido con id 99 no encontrado"));

        mockMvc.perform(get("/api/orders/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Pedido con id 99 no encontrado"))
                .andExpect(jsonPath("$.path").value("/api/orders/99"));
    }

    // ---------- GET /api/orders/pending ----------

    @Test
    void pendingUsesDefaultLimitOf20() throws Exception {
        when(orderService.findPending(20)).thenReturn(List.of(sampleOrder()));

        mockMvc.perform(get("/api/orders/pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].status").value("PENDING"));

        verify(orderService).findPending(20);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 100})
    void pendingAcceptsLimitBounds(int limit) throws Exception {
        when(orderService.findPending(limit)).thenReturn(List.of());

        mockMvc.perform(get("/api/orders/pending").param("limit", String.valueOf(limit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101", "-5", "abc"})
    void pendingRejectsInvalidLimit(String limit) throws Exception {
        mockMvc.perform(get("/api/orders/pending").param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.path").value("/api/orders/pending"));

        verify(orderService, never()).findPending(anyInt());
    }

    // ---------- GET /api/orders/{id}/context ----------

    @Test
    void contextReturnsWarningsAndDaysUntilDelivery() throws Exception {
        OrderContextResponse context = new OrderContextResponse(
                sampleOrder(),
                new CustomerResponse(1L, "Ana Torres", "ana.torres@example.com", "55 1000 0001"),
                new CustomerStats(3, new BigDecimal("2195.00")),
                List.of(new StockWarning("CAKE-3LCH", "Pastel de tres leches", 3, 2)),
                2);
        when(orderService.getContext(7L)).thenReturn(context);

        mockMvc.perform(get("/api/orders/7/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.id").value(7))
                .andExpect(jsonPath("$.customer.email").value("ana.torres@example.com"))
                .andExpect(jsonPath("$.customerStats.totalOrders").value(3))
                .andExpect(jsonPath("$.customerStats.totalSpent").value(2195.00))
                .andExpect(jsonPath("$.stockWarnings", hasSize(1)))
                .andExpect(jsonPath("$.stockWarnings[0].sku").value("CAKE-3LCH"))
                .andExpect(jsonPath("$.stockWarnings[0].productName").value("Pastel de tres leches"))
                .andExpect(jsonPath("$.stockWarnings[0].requested").value(3))
                .andExpect(jsonPath("$.stockWarnings[0].available").value(2))
                .andExpect(jsonPath("$.daysUntilDelivery").value(2));
    }

    @Test
    void contextReturns404WhenOrderDoesNotExist() throws Exception {
        when(orderService.getContext(99L)).thenThrow(new ResourceNotFoundException("Pedido con id 99 no encontrado"));

        mockMvc.perform(get("/api/orders/99/context"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.path").value("/api/orders/99/context"));
    }

    // ---------- write endpoints ----------

    @Test
    void createReturns201() throws Exception {
        when(orderService.create(any())).thenReturn(sampleOrder());

        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("""
                        {"customerId":1,"deliveryDate":"2026-11-26","items":[{"productId":2,"quantity":3}]}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(7));
    }

    @Test
    void createReturns400WhenBodyIsInvalid() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("""
                        {"customerId":1,"deliveryDate":"2026-11-26","items":[{"productId":2,"quantity":0}]}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value(containsString("items[0].quantity")));

        verifyNoInteractions(orderService);
    }

    @Test
    void createReturns400WhenItemsAreEmpty() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("""
                        {"customerId":1,"deliveryDate":"2026-11-26","items":[]}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("items")));
    }

    @Test
    void createReturns409WhenStockIsInsufficient() throws Exception {
        when(orderService.create(any())).thenThrow(new BusinessRuleException("Stock insuficiente para CAKE-3LCH"));

        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("""
                        {"customerId":1,"deliveryDate":"2026-11-26","items":[{"productId":2,"quantity":5}]}
                        """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"));
    }

    @Test
    void updateStatusReturns409OnInvalidTransition() throws Exception {
        when(orderService.updateStatus(eq(7L), eq(OrderStatus.DELIVERED)))
                .thenThrow(new BusinessRuleException("No se puede cambiar el pedido 7 de PENDING a DELIVERED"));

        mockMvc.perform(patch("/api/orders/7/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DELIVERED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("PENDING a DELIVERED")));
    }

    @Test
    void updateStatusReturns400OnUnknownStatus() throws Exception {
        mockMvc.perform(patch("/api/orders/7/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BAKED\"}"))
                .andExpect(status().isBadRequest());
    }
}

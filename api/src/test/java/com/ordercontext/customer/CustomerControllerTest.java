package com.ordercontext.customer;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.ordercontext.common.ResourceNotFoundException;
import com.ordercontext.order.OrderResponse;
import com.ordercontext.order.OrderStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CustomerController.class)
class CustomerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @Test
    void summaryReturnsContractShape() throws Exception {
        Map<OrderStatus, Long> byStatus = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            byStatus.put(status, 0L);
        }
        byStatus.put(OrderStatus.DELIVERED, 1L);
        byStatus.put(OrderStatus.PENDING, 1L);

        OrderResponse recent = new OrderResponse(10L, 1L, "Ana Torres", OrderStatus.PENDING,
                Instant.parse("2026-11-23T16:00:00Z"), LocalDate.of(2026, 11, 29), null, List.of(),
                new BigDecimal("1260.00"));

        CustomerSummaryResponse summary = new CustomerSummaryResponse(
                new CustomerResponse(1L, "Ana Torres", "ana.torres@example.com", "55 1000 0001"),
                2, new BigDecimal("1735.00"), Instant.parse("2026-11-23T16:00:00Z"), byStatus, List.of(recent));
        when(customerService.getSummary(1L)).thenReturn(summary);

        mockMvc.perform(get("/api/customers/1/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(1))
                .andExpect(jsonPath("$.customer.name").value("Ana Torres"))
                .andExpect(jsonPath("$.customer.phone").value("55 1000 0001"))
                .andExpect(jsonPath("$.totalOrders").value(2))
                .andExpect(jsonPath("$.totalSpent").value(1735.00))
                .andExpect(jsonPath("$.lastOrderAt").value("2026-11-23T16:00:00Z"))
                .andExpect(jsonPath("$.ordersByStatus.PENDING").value(1))
                .andExpect(jsonPath("$.ordersByStatus.DELIVERED").value(1))
                .andExpect(jsonPath("$.ordersByStatus.CANCELLED").value(0))
                .andExpect(jsonPath("$.recentOrders", hasSize(1)))
                .andExpect(jsonPath("$.recentOrders[0].id").value(10));
    }

    @Test
    void summaryReturns404WhenCustomerDoesNotExist() throws Exception {
        when(customerService.getSummary(99L)).thenThrow(new ResourceNotFoundException("Cliente con id 99 no encontrado"));

        mockMvc.perform(get("/api/customers/99/summary"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Cliente con id 99 no encontrado"))
                .andExpect(jsonPath("$.path").value("/api/customers/99/summary"));
    }
}

package com.ordercontext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.in;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.jayway.jsonpath.JsonPath;
import com.ordercontext.product.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the whole application (H2 + seed data) and calls the real endpoints.
 * Each test runs in a transaction that is rolled back, so tests don't affect each other.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrderContextApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private Clock clock;

    @Test
    void lowStockReturnsTheThreeSeededProductsMostCriticalFirst() throws Exception {
        mockMvc.perform(get("/api/products/low-stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].sku").value("CUP-RDVL"))      // 10 - 12 = -2
                .andExpect(jsonPath("$[1].sku").value("CAKE-3LCH"))     //  2 -  3 = -1
                .andExpect(jsonPath("$[2].sku").value("BREAD-CUERNO"))  // 25 - 25 =  0
                .andExpect(content().string(containsString("\"price\":420.00")));
    }

    @Test
    void pendingReturnsOnlyActiveOrdersSortedByDeliveryDate() throws Exception {
        String json = mockMvc.perform(get("/api/orders/pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(8)))
                .andExpect(jsonPath("$[*].status", everyItem(in(List.of("PENDING", "CONFIRMED", "IN_PREPARATION")))))
                .andReturn().getResponse().getContentAsString();

        List<String> dates = JsonPath.read(json, "$[*].deliveryDate");
        assertThat(dates).isSorted();
    }

    @Test
    void pendingRespectsLimit() throws Exception {
        mockMvc.perform(get("/api/orders/pending").param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    void customerSummaryOfSeededCustomer() throws Exception {
        // Ana Torres: orders 1 (DELIVERED 475.00), 5 (IN_PREPARATION 470.00), 10 (PENDING 1260.00)
        mockMvc.perform(get("/api/customers/1/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.name").value("Ana Torres"))
                .andExpect(jsonPath("$.totalOrders").value(3))
                .andExpect(jsonPath("$.totalSpent").value(2205.00))
                .andExpect(jsonPath("$.ordersByStatus.DELIVERED").value(1))
                .andExpect(jsonPath("$.ordersByStatus.IN_PREPARATION").value(1))
                .andExpect(jsonPath("$.ordersByStatus.PENDING").value(1))
                .andExpect(jsonPath("$.recentOrders", hasSize(3)))
                .andExpect(jsonPath("$.recentOrders[0].id").value(10));
    }

    @Test
    void orderContextOfSeededOrderWithLowStock() throws Exception {
        mockMvc.perform(get("/api/orders/10/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.id").value(10))
                .andExpect(jsonPath("$.customer.name").value("Ana Torres"))
                .andExpect(jsonPath("$.customerStats.totalOrders").value(3))
                .andExpect(jsonPath("$.stockWarnings[0].sku").value("CAKE-3LCH"))
                .andExpect(jsonPath("$.stockWarnings[0].requested").value(3))
                .andExpect(jsonPath("$.stockWarnings[0].available").value(2))
                .andExpect(jsonPath("$.daysUntilDelivery").value(5));
    }

    @Test
    void unknownIdsReturn404() throws Exception {
        mockMvc.perform(get("/api/orders/999")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/orders/999/context")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/999/summary"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Not Found"));
    }

    @Test
    void createThenCancelReservesAndRestoresStock() throws Exception {
        // Product 4 = Cupcake de vainilla, 40 in stock
        String body = """
                {"customerId":2,"deliveryDate":"%s","items":[{"productId":4,"quantity":6}]}
                """.formatted(LocalDate.now(clock).plusDays(2));

        String json = mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.total").value(210.00))
                .andReturn().getResponse().getContentAsString();
        Integer orderId = JsonPath.read(json, "$.id");
        assertThat(productRepository.findById(4L).orElseThrow().getStock()).isEqualTo(34);

        mockMvc.perform(patch("/api/orders/{id}/status", orderId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(productRepository.findById(4L).orElseThrow().getStock()).isEqualTo(40);
    }

    @Test
    void createWithPastDeliveryDateReturns400() throws Exception {
        String body = """
                {"customerId":2,"deliveryDate":"%s","items":[{"productId":4,"quantity":1}]}
                """.formatted(LocalDate.now(clock).minusDays(1));

        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("pasado")));
    }
}

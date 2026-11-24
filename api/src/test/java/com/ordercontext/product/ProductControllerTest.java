package com.ordercontext.product;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    @Test
    void lowStockReturnsProductsWithContractShape() throws Exception {
        when(productService.findLowStock()).thenReturn(List.of(
                new ProductResponse(5L, "CUP-RDVL", "Cupcake red velvet", ProductCategory.CUPCAKE,
                        new BigDecimal("40.00"), 10, 12),
                new ProductResponse(2L, "CAKE-3LCH", "Pastel de tres leches", ProductCategory.CAKE,
                        new BigDecimal("420.00"), 2, 3)));

        mockMvc.perform(get("/api/products/low-stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].sku").value("CUP-RDVL"))
                .andExpect(jsonPath("$[0].name").value("Cupcake red velvet"))
                .andExpect(jsonPath("$[0].category").value("CUPCAKE"))
                .andExpect(jsonPath("$[0].price").value(40.00))
                .andExpect(jsonPath("$[0].stock").value(10))
                .andExpect(jsonPath("$[0].minStock").value(12))
                .andExpect(jsonPath("$[1].sku").value("CAKE-3LCH"));
    }

    @Test
    void lowStockReturnsEmptyArrayWhenNothingIsLow() throws Exception {
        when(productService.findLowStock()).thenReturn(List.of());

        mockMvc.perform(get("/api/products/low-stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}

package com.ordercontext.product;

import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    @Operation(summary = "List all products")
    public List<ProductResponse> findAll() {
        return productService.findAll();
    }

    @GetMapping("/low-stock")
    @Operation(summary = "Products with stock <= minStock, most critical first")
    public List<ProductResponse> findLowStock() {
        return productService.findLowStock();
    }
}

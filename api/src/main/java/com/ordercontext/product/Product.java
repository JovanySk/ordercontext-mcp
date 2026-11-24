package com.ordercontext.product;

import java.math.BigDecimal;

import com.ordercontext.common.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String sku;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductCategory category;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int stock;

    @Column(nullable = false)
    private int minStock;

    /** Optimistic locking: two orders cannot reserve the same stock at the same time. */
    @Version
    private Long version;

    protected Product() {
        // required by JPA
    }

    public Product(String sku, String name, ProductCategory category, BigDecimal price, int stock, int minStock) {
        this.sku = sku;
        this.name = name;
        this.category = category;
        this.price = price;
        this.stock = stock;
        this.minStock = minStock;
    }

    /** Reserves stock for an order. Throws 409 when there is not enough. */
    public void decreaseStock(int quantity) {
        if (quantity > stock) {
            throw new BusinessRuleException("Stock insuficiente para " + sku + " (" + name + "): solicitado "
                    + quantity + ", disponible " + stock);
        }
        stock -= quantity;
    }

    /** Returns stock, e.g. when an order is cancelled. */
    public void increaseStock(int quantity) {
        stock += quantity;
    }

    public boolean isLowStock() {
        return stock <= minStock;
    }

    public Long getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public String getName() {
        return name;
    }

    public ProductCategory getCategory() {
        return category;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public int getStock() {
        return stock;
    }

    public int getMinStock() {
        return minStock;
    }
}

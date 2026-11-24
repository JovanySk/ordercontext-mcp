package com.ordercontext.product;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long> {

    /** Products with stock <= minStock, the most critical (largest shortfall) first. */
    @Query("select p from Product p where p.stock <= p.minStock order by (p.stock - p.minStock) asc, p.id asc")
    List<Product> findLowStock();
}

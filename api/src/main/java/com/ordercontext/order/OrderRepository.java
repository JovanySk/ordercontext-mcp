package com.ordercontext.order;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    @EntityGraph(attributePaths = "customer")
    List<Order> findByStatusInOrderByDeliveryDateAscIdAsc(Collection<OrderStatus> statuses, Pageable pageable);
}

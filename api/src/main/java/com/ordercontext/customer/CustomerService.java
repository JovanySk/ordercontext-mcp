package com.ordercontext.customer;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.ordercontext.common.ResourceNotFoundException;
import com.ordercontext.order.Order;
import com.ordercontext.order.OrderRepository;
import com.ordercontext.order.OrderResponse;
import com.ordercontext.order.OrderStatus;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    static final int RECENT_ORDERS_LIMIT = 5;

    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;

    public CustomerService(CustomerRepository customerRepository, OrderRepository orderRepository) {
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
    }

    public List<CustomerResponse> findAll() {
        return customerRepository.findAll(Sort.by("id")).stream()
                .map(CustomerResponse::from)
                .toList();
    }

    public Customer getCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente con id " + id + " no encontrado"));
    }

    public CustomerSummaryResponse getSummary(Long customerId) {
        Customer customer = getCustomer(customerId);
        List<Order> orders = orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);

        CustomerStats stats = CustomerStats.of(orders);

        Instant lastOrderAt = orders.isEmpty() ? null : orders.get(0).getCreatedAt();

        Map<OrderStatus, Long> ordersByStatus = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            ordersByStatus.put(status, 0L);
        }
        orders.forEach(order -> ordersByStatus.merge(order.getStatus(), 1L, Long::sum));

        List<OrderResponse> recentOrders = orders.stream()
                .limit(RECENT_ORDERS_LIMIT)
                .map(OrderResponse::from)
                .toList();

        return new CustomerSummaryResponse(
                CustomerResponse.from(customer),
                stats.totalOrders(),
                stats.totalSpent(),
                lastOrderAt,
                ordersByStatus,
                recentOrders);
    }
}

package com.ordercontext.order;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import com.ordercontext.common.InvalidRequestException;
import com.ordercontext.common.ResourceNotFoundException;
import com.ordercontext.customer.Customer;
import com.ordercontext.customer.CustomerRepository;
import com.ordercontext.customer.CustomerResponse;
import com.ordercontext.customer.CustomerStats;
import com.ordercontext.product.Product;
import com.ordercontext.product.ProductRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrderService {

    public static final int MIN_QUANTITY = 1;
    public static final int MAX_QUANTITY = 100;

    private static final Set<OrderStatus> PENDING_STATUSES =
            EnumSet.of(OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION);

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final Clock clock;

    public OrderService(OrderRepository orderRepository,
                        CustomerRepository customerRepository,
                        ProductRepository productRepository,
                        Clock clock) {
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.clock = clock;
    }

    public OrderResponse findById(Long id) {
        return OrderResponse.from(getOrder(id));
    }

    /** Orders still to be delivered, the closest delivery date first. */
    public List<OrderResponse> findPending(int limit) {
        return orderRepository
                .findByStatusInOrderByDeliveryDateAscIdAsc(PENDING_STATUSES, PageRequest.of(0, limit))
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    public OrderContextResponse getContext(Long id) {
        Order order = getOrder(id);
        Customer customer = order.getCustomer();
        List<Order> customerOrders = orderRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId());

        long daysUntilDelivery = ChronoUnit.DAYS.between(LocalDate.now(clock), order.getDeliveryDate());

        return new OrderContextResponse(
                OrderResponse.from(order),
                CustomerResponse.from(customer),
                CustomerStats.of(customerOrders),
                stockWarnings(order),
                daysUntilDelivery);
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest request) {
        validate(request);

        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente con id " + request.customerId() + " no encontrado"));

        Instant now = Instant.now(clock).truncatedTo(ChronoUnit.SECONDS);
        Order order = new Order(customer, OrderStatus.PENDING, now, request.deliveryDate(), request.notes());

        for (OrderItemRequest itemRequest : request.items()) {
            Product product = productRepository.findById(itemRequest.productId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto con id " + itemRequest.productId() + " no encontrado"));
            // Reserve stock: throws 409 if there is not enough. The whole transaction is rolled back.
            product.decreaseStock(itemRequest.quantity());
            order.addItem(product, itemRequest.quantity());
        }

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateStatus(Long id, OrderStatus newStatus) {
        Order order = getOrder(id);
        order.changeStatus(newStatus);

        if (newStatus == OrderStatus.CANCELLED) {
            // Give back the stock that was reserved when the order was created
            order.getItems().forEach(item -> item.getProduct().increaseStock(item.getQuantity()));
        }
        return OrderResponse.from(order);
    }

    private Order getOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido con id " + id + " no encontrado"));
    }

    /**
     * Business validations. Bean Validation already checks the HTTP body, but the service
     * protects itself too, because it can be called from other places (and is unit tested alone).
     */
    private void validate(CreateOrderRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new InvalidRequestException("El pedido debe contener al menos un producto");
        }
        for (OrderItemRequest item : request.items()) {
            if (item.quantity() == null || item.quantity() < MIN_QUANTITY || item.quantity() > MAX_QUANTITY) {
                throw new InvalidRequestException(
                        "La cantidad de cada producto debe estar entre " + MIN_QUANTITY + " y " + MAX_QUANTITY);
            }
        }
        if (request.deliveryDate() == null || request.deliveryDate().isBefore(LocalDate.now(clock))) {
            throw new InvalidRequestException("La fecha de entrega no puede estar en el pasado");
        }
    }

    /**
     * Only active orders get warnings. An item is flagged when its product is in low stock
     * (stock <= minStock) or the current stock is lower than the quantity of the item.
     */
    private List<StockWarning> stockWarnings(Order order) {
        if (!order.getStatus().isActive()) {
            return List.of();
        }
        return order.getItems().stream()
                .filter(item -> item.getProduct().isLowStock() || item.getProduct().getStock() < item.getQuantity())
                .map(item -> new StockWarning(
                        item.getProduct().getSku(),
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getProduct().getStock()))
                .toList();
    }
}

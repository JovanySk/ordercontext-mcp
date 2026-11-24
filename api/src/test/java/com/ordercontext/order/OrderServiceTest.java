package com.ordercontext.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import com.ordercontext.common.BusinessRuleException;
import com.ordercontext.common.InvalidRequestException;
import com.ordercontext.common.ResourceNotFoundException;
import com.ordercontext.customer.Customer;
import com.ordercontext.customer.CustomerRepository;
import com.ordercontext.product.Product;
import com.ordercontext.product.ProductCategory;
import com.ordercontext.product.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    /** 2026-11-24 10:00 in Mexico City. */
    private static final Instant NOW = Instant.parse("2026-11-24T16:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 24);

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private ProductRepository productRepository;

    private OrderService orderService;

    private Customer customer;
    private Product chocolateCake;
    private Product bolillo;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneId.of("America/Mexico_City"));
        orderService = new OrderService(orderRepository, customerRepository, productRepository, clock);

        customer = withId(new Customer("Ana Torres", "ana.torres@example.com", "55 1000 0001"), 1L);
        chocolateCake = withId(new Product("CAKE-CHOC", "Pastel de chocolate", ProductCategory.CAKE,
                new BigDecimal("450.00"), 8, 3), 10L);
        bolillo = withId(new Product("BREAD-BOLILLO", "Bolillo", ProductCategory.BREAD,
                new BigDecimal("4.50"), 100, 40), 20L);
    }

    // ---------- create ----------

    @Test
    void createReservesStockAndReturnsPendingOrder() {
        givenCustomerAndProductsExist();
        givenSaveAssignsId();

        OrderResponse response = orderService.create(request(TODAY.plusDays(2),
                new OrderItemRequest(10L, 2), new OrderItemRequest(20L, 10)));

        assertThat(response.id()).isEqualTo(100L);
        assertThat(response.status()).isEqualTo(OrderStatus.PENDING);
        assertThat(response.customerName()).isEqualTo("Ana Torres");
        assertThat(response.createdAt()).isEqualTo(NOW);
        assertThat(response.items()).hasSize(2);
        assertThat(chocolateCake.getStock()).isEqualTo(6);
        assertThat(bolillo.getStock()).isEqualTo(90);
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    void createComputesSubtotalsAndTotal() {
        givenCustomerAndProductsExist();
        givenSaveAssignsId();

        OrderResponse response = orderService.create(request(TODAY.plusDays(1),
                new OrderItemRequest(10L, 1), new OrderItemRequest(20L, 3)));

        assertThat(response.items().get(0).subtotal()).isEqualByComparingTo("450.00");
        assertThat(response.items().get(1).unitPrice()).isEqualByComparingTo("4.50");
        assertThat(response.items().get(1).subtotal()).isEqualByComparingTo("13.50");
        assertThat(response.total()).isEqualTo(new BigDecimal("463.50"));
    }

    @Test
    void createAllowsDeliveryToday() {
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));
        when(productRepository.findById(20L)).thenReturn(Optional.of(bolillo));
        givenSaveAssignsId();

        OrderResponse response = orderService.create(request(TODAY, new OrderItemRequest(20L, 5)));

        assertThat(response.deliveryDate()).isEqualTo(TODAY);
    }

    @Test
    void createFailsWithConflictWhenStockIsInsufficient() {
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));
        when(productRepository.findById(10L)).thenReturn(Optional.of(chocolateCake));

        assertThatThrownBy(() -> orderService.create(request(TODAY.plusDays(1), new OrderItemRequest(10L, 9))))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("CAKE-CHOC")
                .hasMessageContaining("disponible 8");

        assertThat(chocolateCake.getStock()).isEqualTo(8);
        verify(orderRepository, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, 101})
    void createRejectsQuantityOutOfRange(int quantity) {
        assertThatThrownBy(() -> orderService.create(request(TODAY.plusDays(1), new OrderItemRequest(10L, quantity))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("entre 1 y 100");

        verifyNoInteractions(customerRepository, productRepository, orderRepository);
    }

    @Test
    void createRejectsDeliveryDateInThePast() {
        assertThatThrownBy(() -> orderService.create(request(TODAY.minusDays(1), new OrderItemRequest(10L, 1))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("pasado");

        verifyNoInteractions(orderRepository);
    }

    @Test
    void createRejectsOrderWithoutItems() {
        CreateOrderRequest request = new CreateOrderRequest(1L, TODAY.plusDays(1), null, List.of());

        assertThatThrownBy(() -> orderService.create(request))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void createFailsWhenCustomerDoesNotExist() {
        when(customerRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.create(request(TODAY.plusDays(1), new OrderItemRequest(10L, 1))))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Cliente");
    }

    @Test
    void createFailsWhenProductDoesNotExist() {
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.create(request(TODAY.plusDays(1), new OrderItemRequest(99L, 1))))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Producto");
    }

    // ---------- status transitions ----------

    @ParameterizedTest(name = "{0} -> {1} is allowed")
    @CsvSource({
            "PENDING, CONFIRMED",
            "CONFIRMED, IN_PREPARATION",
            "IN_PREPARATION, DELIVERED",
            "PENDING, CANCELLED",
            "CONFIRMED, CANCELLED"
    })
    void updateStatusAllowsValidTransitions(OrderStatus from, OrderStatus to) {
        givenOrderExists(from);

        OrderResponse response = orderService.updateStatus(5L, to);

        assertThat(response.status()).isEqualTo(to);
    }

    @ParameterizedTest(name = "{0} -> {1} is rejected")
    @MethodSource("invalidTransitions")
    void updateStatusRejectsInvalidTransitions(OrderStatus from, OrderStatus to) {
        Order order = givenOrderExists(from);

        assertThatThrownBy(() -> orderService.updateStatus(5L, to))
                .isInstanceOf(BusinessRuleException.class);

        assertThat(order.getStatus()).isEqualTo(from);
        assertThat(chocolateCake.getStock()).isEqualTo(8);
    }

    static Stream<Arguments> invalidTransitions() {
        return Stream.of(OrderStatus.values())
                .flatMap(from -> Stream.of(OrderStatus.values())
                        .filter(to -> !from.canTransitionTo(to))
                        .map(to -> Arguments.of(from, to)));
    }

    @Test
    void validAndInvalidTransitionsCoverEveryPair() {
        long allowed = Stream.of(OrderStatus.values())
                .flatMap(from -> Stream.of(OrderStatus.values()).filter(from::canTransitionTo))
                .count();
        assertThat(allowed).isEqualTo(5);
        assertThat(invalidTransitions().count()).isEqualTo(20);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "CONFIRMED"})
    void cancelRestocksEveryItem(OrderStatus from) {
        givenOrderExists(from); // 2 x chocolate cake + 10 x bolillo

        orderService.updateStatus(5L, OrderStatus.CANCELLED);

        assertThat(chocolateCake.getStock()).isEqualTo(10);
        assertThat(bolillo.getStock()).isEqualTo(110);
    }

    @Test
    void deliverDoesNotChangeStock() {
        givenOrderExists(OrderStatus.IN_PREPARATION);

        orderService.updateStatus(5L, OrderStatus.DELIVERED);

        assertThat(chocolateCake.getStock()).isEqualTo(8);
        assertThat(bolillo.getStock()).isEqualTo(100);
    }

    @Test
    void updateStatusFailsWhenOrderDoesNotExist() {
        when(orderRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.updateStatus(404L, OrderStatus.CONFIRMED))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- context ----------

    @Test
    void contextIncludesStockWarningsStatsAndDaysUntilDelivery() {
        Product tresLeches = withId(new Product("CAKE-3LCH", "Pastel de tres leches", ProductCategory.CAKE,
                new BigDecimal("420.00"), 2, 3), 30L);
        Order order = withId(new Order(customer, OrderStatus.PENDING, NOW, TODAY.plusDays(3), null), 5L);
        order.addItem(tresLeches, 3);   // low stock and 2 < 3 -> warning
        order.addItem(bolillo, 10);     // 100 in stock, min 40 -> no warning

        Order cancelled = withId(new Order(customer, OrderStatus.CANCELLED, NOW, TODAY, null), 6L);
        cancelled.addItem(chocolateCake, 1);

        when(orderRepository.findById(5L)).thenReturn(Optional.of(order));
        when(orderRepository.findByCustomerIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(order, cancelled));

        OrderContextResponse context = orderService.getContext(5L);

        assertThat(context.daysUntilDelivery()).isEqualTo(3);
        assertThat(context.stockWarnings()).containsExactly(
                new StockWarning("CAKE-3LCH", "Pastel de tres leches", 3, 2));
        assertThat(context.customerStats().totalOrders()).isEqualTo(2);
        assertThat(context.customerStats().totalSpent()).isEqualByComparingTo("1305.00"); // cancelled excluded
        assertThat(context.customer().name()).isEqualTo("Ana Torres");
    }

    @Test
    void contextOfDeliveredOrderHasNoWarningsAndNegativeDays() {
        Product lowStock = withId(new Product("CUP-RDVL", "Cupcake red velvet", ProductCategory.CUPCAKE,
                new BigDecimal("40.00"), 1, 12), 40L);
        Order order = withId(new Order(customer, OrderStatus.DELIVERED, NOW, TODAY.minusDays(2), null), 7L);
        order.addItem(lowStock, 12);
        when(orderRepository.findById(7L)).thenReturn(Optional.of(order));
        when(orderRepository.findByCustomerIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(order));

        OrderContextResponse context = orderService.getContext(7L);

        assertThat(context.stockWarnings()).isEmpty();
        assertThat(context.daysUntilDelivery()).isEqualTo(-2);
    }

    // ---------- helpers ----------

    private void givenCustomerAndProductsExist() {
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));
        when(productRepository.findById(10L)).thenReturn(Optional.of(chocolateCake));
        when(productRepository.findById(20L)).thenReturn(Optional.of(bolillo));
    }

    private void givenSaveAssignsId() {
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> withId(invocation.getArgument(0), 100L));
    }

    private Order givenOrderExists(OrderStatus status) {
        Order order = withId(new Order(customer, status, NOW, TODAY.plusDays(2), null), 5L);
        order.addItem(chocolateCake, 2);
        order.addItem(bolillo, 10);
        when(orderRepository.findById(5L)).thenReturn(Optional.of(order));
        return order;
    }

    private static CreateOrderRequest request(LocalDate deliveryDate, OrderItemRequest... items) {
        return new CreateOrderRequest(1L, deliveryDate, "nota", List.of(items));
    }

    private static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}

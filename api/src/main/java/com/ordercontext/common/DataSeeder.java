package com.ordercontext.common;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.ordercontext.customer.Customer;
import com.ordercontext.customer.CustomerRepository;
import com.ordercontext.order.Order;
import com.ordercontext.order.OrderRepository;
import com.ordercontext.order.OrderStatus;
import com.ordercontext.product.Product;
import com.ordercontext.product.ProductCategory;
import com.ordercontext.product.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads demo data for a small bakery ("Pastelería") when the database is empty.
 * All names are fictional. Dates are relative to today so the data always looks current.
 * Stock values already take into account the stock reserved by the active orders.
 * Disable with app.seed.enabled=false.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final Clock clock;

    public DataSeeder(CustomerRepository customerRepository,
                      ProductRepository productRepository,
                      OrderRepository orderRepository,
                      Clock clock) {
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (customerRepository.count() > 0) {
            log.info("Database already has data, skipping seed");
            return;
        }

        Customer ana = new Customer("Ana Torres", "ana.torres@example.com", "55 1000 0001");
        Customer luis = new Customer("Luis Hernández", "luis.hernandez@example.com", "55 1000 0002");
        Customer maria = new Customer("María Gómez", "maria.gomez@example.com", "55 1000 0003");
        Customer carlos = new Customer("Carlos Ramírez", "carlos.ramirez@example.com", "55 1000 0004");
        Customer sofia = new Customer("Sofía Méndez", "sofia.mendez@example.com", "55 1000 0005");
        customerRepository.saveAll(List.of(ana, luis, maria, carlos, sofia));

        Product chocolateCake = product("CAKE-CHOC", "Pastel de chocolate", ProductCategory.CAKE, "450.00", 8, 3);
        Product tresLechesCake = product("CAKE-3LCH", "Pastel de tres leches", ProductCategory.CAKE, "420.00", 2, 3);
        Product carrotCake = product("CAKE-ZANA", "Pastel de zanahoria", ProductCategory.CAKE, "480.00", 6, 2);
        Product vanillaCupcake = product("CUP-VAIN", "Cupcake de vainilla", ProductCategory.CUPCAKE, "35.00", 40, 12);
        Product redVelvetCupcake = product("CUP-RDVL", "Cupcake red velvet", ProductCategory.CUPCAKE, "40.00", 10, 12);
        Product concha = product("BREAD-CONCHA", "Concha", ProductCategory.BREAD, "12.00", 60, 20);
        Product bolillo = product("BREAD-BOLILLO", "Bolillo", ProductCategory.BREAD, "4.50", 120, 40);
        Product cuernito = product("BREAD-CUERNO", "Cuernito de mantequilla", ProductCategory.BREAD, "18.00", 25, 25);
        Product candles = product("SUP-VELAS", "Velas de cumpleaños (paquete)", ProductCategory.SUPPLIES, "25.00", 30, 10);
        Product cakeBox = product("SUP-CAJA", "Caja para pastel", ProductCategory.SUPPLIES, "15.00", 50, 15);
        productRepository.saveAll(List.of(chocolateCake, tresLechesCake, carrotCake, vanillaCupcake,
                redVelvetCupcake, concha, bolillo, cuernito, candles, cakeBox));

        // Delivered and cancelled orders (history)
        Order o1 = order(ana, OrderStatus.DELIVERED, 20, -18, "Entregar por la tarde");
        o1.addItem(chocolateCake, 1);
        o1.addItem(candles, 1);

        Order o2 = order(luis, OrderStatus.DELIVERED, 15, -13, "Pan para reunión de oficina");
        o2.addItem(concha, 24);
        o2.addItem(bolillo, 40);

        Order o3 = order(maria, OrderStatus.DELIVERED, 10, -7, null);
        o3.addItem(carrotCake, 1);
        o3.addItem(cakeBox, 1);

        Order o4 = order(carlos, OrderStatus.CANCELLED, 8, -5, "Cliente canceló por cambio de fecha");
        o4.addItem(vanillaCupcake, 12);

        // Active orders (stock already reserved)
        Order o5 = order(ana, OrderStatus.IN_PREPARATION, 4, 0, "Escribir 'Feliz cumpleaños, Sofi'");
        o5.addItem(tresLechesCake, 1);
        o5.addItem(candles, 2);

        Order o6 = order(sofia, OrderStatus.IN_PREPARATION, 3, 1, "Desayuno familiar");
        o6.addItem(cuernito, 30);

        Order o7 = order(luis, OrderStatus.CONFIRMED, 3, 2, null);
        o7.addItem(redVelvetCupcake, 12);

        Order o8 = order(maria, OrderStatus.CONFIRMED, 2, 3, "Dos pasteles en cajas separadas");
        o8.addItem(chocolateCake, 2);
        o8.addItem(cakeBox, 2);

        Order o9 = order(carlos, OrderStatus.CONFIRMED, 2, 4, null);
        o9.addItem(bolillo, 50);
        o9.addItem(concha, 20);

        Order o10 = order(ana, OrderStatus.PENDING, 1, 5, "Para la fiesta de la oficina");
        o10.addItem(tresLechesCake, 3);

        Order o11 = order(sofia, OrderStatus.PENDING, 1, 6, null);
        o11.addItem(vanillaCupcake, 24);
        o11.addItem(candles, 1);

        Order o12 = new Order(luis, OrderStatus.PENDING,
                Instant.now(clock).minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS),
                today().plusDays(7), "Sin nueces, por favor");
        o12.addItem(carrotCake, 1);

        orderRepository.saveAll(List.of(o1, o2, o3, o4, o5, o6, o7, o8, o9, o10, o11, o12));
        log.info("Seed data loaded: 5 customers, 10 products, 12 orders");
    }

    private static Product product(String sku, String name, ProductCategory category, String price,
                                   int stock, int minStock) {
        return new Product(sku, name, category, new BigDecimal(price), stock, minStock);
    }

    /** Order created {@code createdDaysAgo} days ago at 10:00 and delivered {@code deliveryInDays} from today. */
    private Order order(Customer customer, OrderStatus status, int createdDaysAgo, int deliveryInDays, String notes) {
        Instant createdAt = ZonedDateTime.of(today().minusDays(createdDaysAgo).atTime(10, 0), clock.getZone())
                .toInstant();
        return new Order(customer, status, createdAt, today().plusDays(deliveryInDays), notes);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}

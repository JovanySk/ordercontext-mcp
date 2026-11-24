package com.ordercontext.common;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI orderContextOpenApi() {
        return new OpenAPI().info(new Info()
                .title("OrderContext API")
                .version("v1")
                .description("Order management API for a local bakery: customers, products and orders."));
    }
}

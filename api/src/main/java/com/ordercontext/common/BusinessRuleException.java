package com.ordercontext.common;

/** Thrown when a request is well-formed but breaks a business rule (e.g. not enough stock). Mapped to HTTP 409. */
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }
}

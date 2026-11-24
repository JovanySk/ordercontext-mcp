package com.ordercontext.common;

/** Thrown when input data is invalid (e.g. delivery date in the past). Mapped to HTTP 400. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}

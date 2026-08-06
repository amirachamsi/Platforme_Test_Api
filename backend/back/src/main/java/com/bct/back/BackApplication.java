package com.bct.back;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackApplication {

    public static void main(String[] args) {
        System.setProperty("java.net.useSystemProxies", "true");
        SpringApplication.run(BackApplication.class, args);
    }

}

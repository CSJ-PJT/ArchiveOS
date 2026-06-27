package com.archiveos.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class ArchiveOsAiApplication {
    public static void main(String[] args) {
        SpringApplication.run(ArchiveOsAiApplication.class, args);
    }
}

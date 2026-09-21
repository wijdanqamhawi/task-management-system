package com.computercenter.taskmanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * T031 — application entry point.
 *
 * <p>{@code @EnableScheduling} supports the date-driven notification triggers of FR-056 and
 * FR-057, which are the only work in the system that runs without a user request (R-007).
 * Nothing else in the application depends on the scheduler.
 */
@SpringBootApplication
@EnableScheduling
public class TaskManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(TaskManagementApplication.class, args);
    }
}

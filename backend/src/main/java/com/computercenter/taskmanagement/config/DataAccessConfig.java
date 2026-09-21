package com.computercenter.taskmanagement.config;

import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

/**
 * T032 — data access wiring.
 *
 * <p>There is no ORM here and there never will be (research.md R-001). Spring Boot
 * auto-configures {@code JdbcTemplate} from the datasource; this class adds
 * {@link NamedParameterJdbcTemplate}, which the repositories use so that the dynamic filter
 * SQL of FR-046..FR-052 stays readable and fully parameterised.
 *
 * <p>The schema is owned by {@code database/ddl/} and is never generated, validated, or
 * altered by the application.
 */
@Configuration
public class DataAccessConfig {

    @Bean
    public NamedParameterJdbcTemplate namedParameterJdbcTemplate(DataSource dataSource) {
        return new NamedParameterJdbcTemplate(dataSource);
    }
}

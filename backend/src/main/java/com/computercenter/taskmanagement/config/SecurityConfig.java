package com.computercenter.taskmanagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

/**
 * T033 — authentication and authorization (FR-002, FR-005, Constitution V).
 *
 * <p>Session-based, per research.md R-002: no token library. A server-side session gives
 * FR-007 an immediate enforcement point, so deactivating a user revokes their access on the
 * next request rather than whenever a token happens to expire.
 *
 * <p>{@code @EnableMethodSecurity} enables the {@code @PreAuthorize} role checks that form
 * the coarse layer of R-003. The fine layer — project and task membership — is enforced in
 * the service layer, because it is data-dependent and cannot be expressed as a role.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** BCrypt. Plaintext passwords are never stored or logged (FR-002). */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // The API is session-cookie authenticated and same-origin in deployment
            // (R-012), so CSRF is disabled for /api and no cross-origin config is needed.
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/register", "/api/auth/login").permitAll()
                // Static frontend assets, served from the backend in deployment (R-012).
                .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico").permitAll()
                // Everything else requires an authenticated, active user.
                .anyRequest().authenticated())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            // A REST API answers 401 rather than redirecting to a login page.
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable());

        return http.build();
    }
}

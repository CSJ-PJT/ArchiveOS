package com.archiveos.ai.security;

import com.archiveos.ai.audit.AuditLogFilter;
import com.archiveos.ai.audit.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SessionAuthenticationFilter sessionFilter,
                                            AuditLogService audit, ObjectMapper mapper) throws Exception {
        AuditLogFilter auditFilter = new AuditLogFilter(audit, mapper);
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> json(response, 401, "Authentication required."))
                        .accessDeniedHandler((request, response, error) -> json(response, 403, "Insufficient role.")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health", "/actuator/health/**", "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/session").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/security/**", "/api/audit/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/mcp/**", "/api/runtime/timeline/**").hasAnyRole("OPERATOR", "PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tasks/*/decision", "/api/tasks/*/retry", "/api/rpa/tasks/*/decision")
                            .hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/approvals/external/*/approve", "/api/approvals/external/*/reject", "/api/approvals/external/*/hold")
                            .hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/batch/**", "/api/batches/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                        .requestMatchers("/api/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .addFilterBefore(sessionFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(auditFilter, SessionAuthenticationFilter.class)
                .build();
    }

    private void json(HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}

package com.archiveos.ai.security;

import com.archiveos.ai.audit.AuditLogFilter;
import com.archiveos.ai.audit.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.webauthn.management.JdbcPublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.JdbcUserCredentialRepository;

@Configuration
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SessionAuthenticationFilter sessionFilter,
                                            AuditLogService audit, ObjectMapper mapper,
                                            PasskeyProperties passkeys) throws Exception {
        AuditLogFilter auditFilter = new AuditLogFilter(audit, mapper);
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> json(response, 401, "Authentication required."))
                        .accessDeniedHandler((request, response, error) -> json(response, 403, "Insufficient role.")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health", "/actuator/health/**", "/api/auth/login", "/api/mail/webhooks/resend").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/audit/usage").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/audit/usage/atlas-report", "/api/audit/usage/atlas-events").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/auth/session").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/auth/admin/users").hasRole("ADMIN")
                        .requestMatchers("/webauthn/register/**").authenticated()
                        .requestMatchers("/webauthn/authenticate/options", "/login/webauthn").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/security/**", "/api/audit/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/openai/usage").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/runtime/public-access").hasRole("ADMIN")
                        // Job catalog and execution telemetry are part of the public, read-only
                        // operations console. Batch launches and every other mutation remain
                        // admin-only below.
                        .requestMatchers(HttpMethod.GET, "/api/batch/jobs", "/api/batch/executions", "/api/batch/executions/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/batch/**").hasRole("ADMIN")
                        .requestMatchers("/api/mail/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/obsidian/documents", "/api/rag/search").hasAnyRole("AUTHENTICATED_READ", "OPERATOR", "PM", "ADMIN")
                        // The public Control Tower exposes question answering, not raw document search.
                        // The controller applies a per-remote rate limit and records a redacted audit event.
                        .requestMatchers(HttpMethod.POST, "/api/rag/ask", "/api/rag/verification/plans").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/rag/verification/plans/*/execute")
                            .hasAnyRole("AUTHENTICATED_READ", "OPERATOR", "PM", "ADMIN")
                        // These endpoints back the public read-only Records/Live Flow views.
                        // Keep entity/correlation/replay and all mutation routes role-gated.
                        .requestMatchers(HttpMethod.GET, "/api/runtime/timeline", "/api/live-flow/events/recent", "/api/live-flow/recent").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/mcp/**", "/api/runtime/timeline/**", "/api/live-flow/events/**", "/api/live-flow/replay", "/api/live-flow/correlation/**", "/api/live-flow/entity/**").hasAnyRole("AUTHENTICATED_READ", "OPERATOR", "PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/live-flow/events/ingest").hasRole("ARCHIVE_INTERNAL_SERVICE")
                        .requestMatchers(HttpMethod.POST, "/api/live-flow/refresh", "/api/ecosystem/balance/simulate").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/ecosystem/demo/dry-run", "/api/game/settlement-agency/simulate", "/api/integrations/market/events/review").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/ai/decisions/analyze").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/ai/decisions/*/approve", "/api/ai/decisions/*/reject").hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/incidents/detect", "/api/incidents/*/analyze").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/incidents/*/acknowledge", "/api/incidents/*/resolve").hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/correlation-timeline/*/explain").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/memory/drafts/*/approve").hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/memory/drafts", "/api/memory/drafts/*/write").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tasks/*/decision", "/api/tasks/*/retry", "/api/rpa/tasks/*/decision")
                            .hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/approvals/external/*/approve", "/api/approvals/external/*/reject", "/api/approvals/external/*/hold")
                            .hasAnyRole("PM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/batch/**", "/api/batches/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/live-flow/summary", "/api/live-flow/topology").permitAll()
                        // The public Control Tower is a read-only operational console. More
                        // sensitive GET routes (security, audit, document/RAG content) are
                        // matched above and remain role-gated; mutations stay admin-only.
                        .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                        .requestMatchers("/api/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .addFilterBefore(sessionFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(auditFilter, SessionAuthenticationFilter.class);
        if (passkeys.enabled()) {
            http.webAuthn(webAuthn -> webAuthn
                    .rpId(passkeys.rpId())
                    .rpName(passkeys.rpName())
                    .allowedOrigins(passkeys.allowedOrigins())
                    .disableDefaultRegistrationPage(true));
        }
        return http.build();
    }

    @Bean
    JdbcPublicKeyCredentialUserEntityRepository passkeyUsers(JdbcOperations jdbc) {
        return new JdbcPublicKeyCredentialUserEntityRepository(jdbc);
    }

    @Bean
    JdbcUserCredentialRepository passkeyCredentials(JdbcOperations jdbc) {
        return new JdbcUserCredentialRepository(jdbc);
    }

    @Bean
    UserDetailsService passkeyUserDetails(AdminCredentialRepository credentials, SecurityProperties properties) {
        return username -> {
            AdminCredentialRepository.Credential stored = credentials.find(username).orElse(null);
            if (stored != null && stored.enabled()) {
                return User.withUsername(stored.username()).password(stored.passwordHash())
                        .roles(stored.role().name()).build();
            }
            if ("admin".equalsIgnoreCase(username) && properties.configured()) {
                return User.withUsername("admin").password("{noop}passkey-only")
                        .roles(PlatformRole.ADMIN.name()).build();
            }
            throw new UsernameNotFoundException("Passkey account is not enabled.");
        };
    }

    private void json(HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}

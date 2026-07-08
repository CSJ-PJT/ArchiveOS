package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class SessionServiceTest {
    @Test
    void createsRoleBoundSessionAndRemovesItOnLogout() {
        SessionService service = new SessionService(new SecurityProperties("test-password", "", 30, 5, 15, false));

        PlatformSession session = service.login("127.0.0.1", "test-password", PlatformRole.PM);

        assertThat(session.role()).isEqualTo(PlatformRole.PM);
        assertThat(service.find(session.id())).contains(session);
        service.logout(session.id());
        assertThat(service.find(session.id())).isEmpty();
    }

    @Test
    void rejectsInvalidPasswordWithoutCreatingSession() {
        SessionService service = new SessionService(new SecurityProperties("test-password", "", 30, 5, 15, false));
        assertThatThrownBy(() -> service.login("127.0.0.1", "wrong", PlatformRole.ADMIN))
                .isInstanceOf(SessionService.LoginRejectedException.class)
                .hasMessage("Invalid credentials.");
    }

    @Test
    void acceptsBcryptPasswordHashFromEnvironment() {
        String hash = new BCryptPasswordEncoder(12).encode("hashed-password");
        SessionService service = new SessionService(new SecurityProperties(hash, "", 30, 5, 15, false));

        PlatformSession session = service.login("127.0.0.1", "hashed-password", PlatformRole.ADMIN);

        assertThat(session.role()).isEqualTo(PlatformRole.ADMIN);
    }

    @Test
    void rateLimitsRepeatedInvalidPasswords() {
        SessionService service = new SessionService(new SecurityProperties("test-password", "", 30, 2, 15, false));
        assertThatThrownBy(() -> service.login("127.0.0.1", "wrong-1", PlatformRole.ADMIN))
                .isInstanceOf(SessionService.LoginRejectedException.class)
                .extracting(error -> ((SessionService.LoginRejectedException) error).rateLimited()).isEqualTo(false);
        assertThatThrownBy(() -> service.login("127.0.0.1", "wrong-2", PlatformRole.ADMIN))
                .isInstanceOf(SessionService.LoginRejectedException.class)
                .extracting(error -> ((SessionService.LoginRejectedException) error).rateLimited()).isEqualTo(false);
        assertThatThrownBy(() -> service.login("127.0.0.1", "wrong-3", PlatformRole.ADMIN))
                .isInstanceOf(SessionService.LoginRejectedException.class)
                .extracting(error -> ((SessionService.LoginRejectedException) error).rateLimited()).isEqualTo(true);
    }
}

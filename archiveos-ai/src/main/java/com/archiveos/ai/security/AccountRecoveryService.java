package com.archiveos.ai.security;

import com.archiveos.ai.mail.MailService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AccountRecoveryService {
    private static final Logger log = LoggerFactory.getLogger(AccountRecoveryService.class);
    private static final Pattern EMAIL = Pattern.compile("^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\\.[A-Z]{2,63}$", Pattern.CASE_INSENSITIVE);
    private static final String GENERIC = "입력한 정보와 일치하는 계정이 있으면 가입된 메일로 안내를 보냈습니다.";
    private final AdminCredentialRepository credentials;
    private final MailService mail;
    private final SecureRandom random = new SecureRandom();
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

    public AccountRecoveryService(AdminCredentialRepository credentials, MailService mail) {
        this.credentials = credentials;
        this.mail = mail;
    }

    public Map<String, Object> requestUsername(String email) {
        String normalized = normalizeEmail(email);
        List<String> usernames = credentials.usernamesByEmail(normalized);
        if (!usernames.isEmpty()) {
            try {
                mail.send(List.of(normalized), List.of(), "ArchiveOS 계정 ID 안내",
                        "가입된 ArchiveOS ID: " + String.join(", ", usernames)
                                + "\n본인이 요청하지 않았다면 이 메일을 무시하세요.", "");
            } catch (RuntimeException error) {
                log.warn("Account ID recovery mail delivery failed.");
            }
        }
        return Map.of("message", GENERIC);
    }

    public Map<String, Object> requestPassword(String usernameOrEmail) {
        String lookup = usernameOrEmail == null ? "" : usernameOrEmail.trim().toLowerCase(Locale.ROOT);
        if (lookup.length() < 3 || lookup.length() > 254) throw new IllegalArgumentException("ID 또는 이메일을 확인해 주세요.");
        credentials.findByUsernameOrEmail(lookup).filter(value -> value.email() != null && !value.email().isBlank()).ifPresent(value -> {
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            credentials.saveResetToken(value.username(), sha256(token), Instant.now().plus(Duration.ofMinutes(15)));
            String link = "https://archiveos.kr/archiveos/#/settings?resetToken=" + token;
            try {
                mail.send(List.of(value.email()), List.of(), "ArchiveOS 비밀번호 재설정",
                        "15분 안에 아래 링크에서 새 비밀번호를 설정하세요.\n" + link
                                + "\n본인이 요청하지 않았다면 이 메일을 무시하세요.", "");
            } catch (RuntimeException error) {
                log.warn("Password recovery mail delivery failed.");
            }
        });
        return Map.of("message", GENERIC);
    }

    @Transactional
    public Map<String, Object> completePasswordReset(String token, String password) {
        String normalizedToken = token == null ? "" : token.trim();
        if (!normalizedToken.matches("[A-Za-z0-9_-]{40,80}")) throw new IllegalArgumentException("재설정 링크가 올바르지 않습니다.");
        if (password == null || password.length() < 16 || password.length() > 256) {
            throw new IllegalArgumentException("새 비밀번호는 16~256자로 입력해 주세요.");
        }
        String tokenHash = sha256(normalizedToken);
        String username = credentials.activeResetUsername(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("재설정 링크가 만료되었거나 이미 사용되었습니다."));
        if (credentials.consumeResetToken(tokenHash) != 1
                || credentials.updatePassword(username, encoder.encode(password), "email-recovery") != 1) {
            throw new IllegalStateException("비밀번호를 변경하지 못했습니다.");
        }
        return Map.of("changed", true);
    }

    private String normalizeEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(normalized).matches() || normalized.length() > 254) throw new IllegalArgumentException("이메일을 확인해 주세요.");
        return normalized;
    }

    private String sha256(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }
}

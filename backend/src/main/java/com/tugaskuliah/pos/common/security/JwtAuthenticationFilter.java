package com.tugaskuliah.pos.common.security;

import com.tugaskuliah.pos.common.exception.ApiException;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Validates Bearer access tokens. Inactive users are rejected even with a valid token
 * (fresh DB lookup per request).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/actuator/health",
            "/error");

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final AntPathMatcher matcher = new AntPathMatcher();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return PUBLIC_PATHS.stream().anyMatch(p -> matcher.match(p, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            final Claims claims;
            try {
                claims = jwtService.parseClaims(token); // throws 401 on invalid/expired
            } catch (ApiException e) {
                // Filters run before @RestControllerAdvice; write the 401 directly.
                SecurityContextHolder.clearContext();
                response.setStatus(e.getErrorCode().getHttpStatus().value());
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"success\":false,\"message\":\"" + e.getMessage() + "\",\"data\":null}");
                return;
            }
            UserDetails user = userDetailsService.loadUserByUsername(claims.getSubject());
            if (!user.isEnabled()) {
                SecurityContextHolder.clearContext();
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"success\":false,\"message\":\"Akun pengguna tidak aktif\",\"data\":null}");
                return;
            }
            var auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}

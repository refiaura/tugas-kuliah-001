package com.tugaskuliah.pos.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.user.dto.CreateUserRequest;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.repository.RoleRepository;
import com.tugaskuliah.pos.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end auth flow against real PostgreSQL (profile "test" -> pos_test).
 * Flyway migrations + seeds run automatically.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuthIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    MockMvc mockMvc;
    ObjectMapper objectMapper = new ObjectMapper();
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
        createKasir();
    }

    void createKasir() {
        if (userRepository.findByUsername("kasir_it").isEmpty()) {
            Role kasir = roleRepository.findByName("KASIR").orElseThrow();
            User u = new User();
            u.setUsername("kasir_it");
            u.setPasswordHash(passwordEncoder.encode("kasir123"));
            u.setFullName("Kasir IT");
            u.setActive(true);
            u.setRoles(Set.of(kasir));
            userRepository.save(u);
        }
    }

    private String login(String username, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token.accessToken").exists())
                .andExpect(jsonPath("$.data.token.refreshToken").exists())
                .andReturn();
        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        return root.path("data").path("token").path("accessToken").asText();
    }

    private String loginRefreshToken(String username, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        return root.path("data").path("token").path("refreshToken").asText();
    }

    @Test
    void login_admin_success_withPermissions() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.username").value("admin"))
                .andExpect(jsonPath("$.data.user.roles").isArray())
                .andExpect(jsonPath("$.data.user.permissions").isArray());
    }

    @Test
    void login_wrongPassword_401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"salah\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void me_returnsProfile() throws Exception {
        String token = login("admin", "admin123");
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("admin"));
    }

    @Test
    void protectedEndpoint_withoutToken_401() throws Exception {
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_invalidToken_401() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer token-ngawur"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void kasir_cannotAccessUserManagement_403() throws Exception {
        String token = login("kasir_it", "kasir123");
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void admin_canAccessUserManagement_200() throws Exception {
        String token = login("admin", "admin123");
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination").exists());
    }

    @Test
    void refresh_rotatesTokens() throws Exception {
        String refresh = loginRefreshToken("admin", "admin123");

        // first refresh OK
        MvcResult res = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        String newAccess = root.path("data").path("accessToken").asText();
        assertFalse(newAccess.isBlank());

        // reusing the old refresh token must fail
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesRefreshToken() throws Exception {
        String refresh = loginRefreshToken("admin", "admin123");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validationError_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void admin_canCreateUser_andNewUserCanLogin() throws Exception {
        String token = login("admin", "admin123");
        String body = objectMapper.writeValueAsString(new CreateUserRequest(
                "kasir_baru", "kasir123", "Kasir Baru", "kasir@baru.id", "0812", Set.of("KASIR")));

        mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value("kasir_baru"));

        // password must be hashed, and the new user can log in
        User saved = userRepository.findByUsername("kasir_baru").orElseThrow();
        assertNotEquals("kasir123", saved.getPasswordHash());
        assertTrue(passwordEncoder.matches("kasir123", saved.getPasswordHash()));
        login("kasir_baru", "kasir123");
    }
}

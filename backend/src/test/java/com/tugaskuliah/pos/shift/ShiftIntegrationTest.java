package com.tugaskuliah.pos.shift;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.shift.repository.CashierShiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Cashier shift flows against real PostgreSQL (profile "test").
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ShiftIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired CashierShiftRepository shiftRepository;
    ObjectMapper om = new ObjectMapper();
    MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).apply(springSecurity()).build();
    }

    private String adminToken() throws Exception {
        var res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(res.getResponse().getContentAsString())
                .path("data").path("token").path("accessToken").asText();
    }

    @Test
    void openShift_success() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":500000}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("OPEN"))
                .andExpect(jsonPath("$.data.openingCash").value(500000));
    }

    @Test
    void openShift_duplicate_rejected() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":500000}"))
                .andExpect(status().isCreated());
        // second open while one is OPEN → conflict
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":300000}"))
                .andExpect(status().isConflict());
    }

    @Test
    void closeShift_varianceCalculated() throws Exception {
        String token = adminToken();
        var openRes = mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":500000}"))
                .andExpect(status().isCreated()).andReturn();
        long shiftId = om.readTree(openRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // cash in 100k, cash out 50k → expected = 500k + 100k - 50k = 550k
        mockMvc.perform(post("/api/v1/shifts/cash-movement")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"amount\":100000,\"reason\":\"Setoran\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/shifts/cash-movement")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"amount\":50000,\"reason\":\"Beli ATK\"}"))
                .andExpect(status().isCreated());

        // close with actual 540k → variance = -10k
        mockMvc.perform(post("/api/v1/shifts/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actualCash\":540000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"))
                .andExpect(jsonPath("$.data.expectedCash").value(550000))
                .andExpect(jsonPath("$.data.actualCash").value(540000))
                .andExpect(jsonPath("$.data.variance").value(-10000));

        // summary still accessible
        mockMvc.perform(get("/api/v1/shifts/" + shiftId + "/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expectedCash").value(550000));
    }

    @Test
    void currentShift_returnsOpen() throws Exception {
        String token = adminToken();
        // no shift yet
        mockMvc.perform(get("/api/v1/shifts/current")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
        // open one
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":100000}"))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/shifts/current")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OPEN"));
    }
}

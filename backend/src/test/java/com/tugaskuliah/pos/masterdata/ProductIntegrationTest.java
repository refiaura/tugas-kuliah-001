package com.tugaskuliah.pos.masterdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.masterdata.entity.Unit;
import com.tugaskuliah.pos.masterdata.repository.ProductRepository;
import com.tugaskuliah.pos.masterdata.repository.UnitRepository;
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
 * Master data product flows against real PostgreSQL (profile "test").
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
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

    private Long pcsUnitId() {
        return unitRepository.findByCode("PCS").map(Unit::getId).orElseThrow();
    }

    private String productJson(String sku, String name) {
        return "{\"sku\":\"" + sku + "\",\"name\":\"" + name + "\",\"unitId\":" + pcsUnitId()
                + ",\"purchasePrice\":5000,\"sellingPrice\":7500}";
    }

    @Test
    void createProduct_success() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-001", "Kopi Tubruk")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sku").value("SKU-001"));
        assertTrue(productRepository.findBySku("SKU-001").isPresent());
    }

    @Test
    void createProduct_duplicateSku_rejected() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-DUP", "Produk A")))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-DUP", "Produk B")))
                .andExpect(status().isConflict());
    }

    @Test
    void updatePrice_recordsHistory() throws Exception {
        String token = adminToken();
        var res = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-HIST", "Gula Pasir")))
                .andExpect(status().isCreated()).andReturn();
        long id = om.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();

        mockMvc.perform(put("/api/v1/products/" + id + "/price")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sellingPrice\":9000,\"reason\":\"naik\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sellingPrice").value(9000));

        mockMvc.perform(get("/api/v1/products/" + id + "/price-history")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].newPrice").value(9000))
                .andExpect(jsonPath("$.data[0].oldPrice").value(7500));
    }

    @Test
    void kasir_cannotCreateProduct_403() throws Exception {
        var login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"kasir_it\",\"password\":\"kasir123\"}"))
                .andReturn();
        // kasir_it may not exist; create via admin if needed
        String kasirToken;
        if (login.getResponse().getStatus() != 200) {
            String admin = adminToken();
            mockMvc.perform(post("/api/v1/users")
                            .header("Authorization", "Bearer " + admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"kasir_it\",\"password\":\"kasir123\",\"fullName\":\"Kasir\",\"roleNames\":[\"KASIR\"]}"))
                    .andExpect(status().isCreated());
            var r2 = mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"kasir_it\",\"password\":\"kasir123\"}"))
                    .andExpect(status().isOk()).andReturn();
            kasirToken = om.readTree(r2.getResponse().getContentAsString())
                    .path("data").path("token").path("accessToken").asText();
        } else {
            kasirToken = om.readTree(login.getResponse().getContentAsString())
                    .path("data").path("token").path("accessToken").asText();
        }
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + kasirToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-KASIR", "Teh")))
                .andExpect(status().isForbidden());
    }

    @Test
    void searchProduct_byName() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("SKU-SRC", "Indomie Goreng")))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/products").param("search", "indomie")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sku").value("SKU-SRC"));
    }
}

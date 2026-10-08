package com.tugaskuliah.pos.sales;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.masterdata.entity.Unit;
import com.tugaskuliah.pos.masterdata.repository.ProductRepository;
import com.tugaskuliah.pos.masterdata.repository.UnitRepository;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
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

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * POS checkout flows against real PostgreSQL (profile "test").
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SaleIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired SaleRepository saleRepository;
    @Autowired InventoryBalanceRepository balanceRepository;
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

    private Product createProduct(String sku, String name, BigDecimal price) {
        Unit pcs = unitRepository.findByCode("PCS").orElseThrow();
        Product p = new Product();
        p.setSku(sku);
        p.setName(name);
        p.setUnit(pcs);
        p.setPurchasePrice(price);
        p.setSellingPrice(price);
        p.setActive(true);
        return productRepository.save(p);
    }

    private void setStock(Long productId, BigDecimal qty) {
        var bal = new com.tugaskuliah.pos.inventory.entity.InventoryBalance();
        bal.setProduct(productRepository.findById(productId).orElseThrow());
        bal.setQty(qty);
        balanceRepository.save(bal);
    }

    private String checkoutJson(Long productId, BigDecimal qty, BigDecimal payAmount, String idemKey) {
        long pmId = 1; // CASH (seeded first)
        return "{\"items\":[{\"productId\":" + productId + ",\"qty\":" + qty + "}],"
                + "\"payments\":[{\"paymentMethodId\":" + pmId + ",\"amount\":" + payAmount + "}]"
                + (idemKey != null ? ",\"idempotencyKey\":\"" + idemKey + "\"" : "") + "}";
    }

    private void openShift(String token) throws Exception {
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":500000}"))
                .andExpect(status().isCreated());
    }

    @Test
    void checkout_valid_success() throws Exception {
        String token = adminToken();
        openShift(token);
        Product p = createProduct("SKU-POS1", "Kopi", new BigDecimal("10000"));
        setStock(p.getId(), new BigDecimal("10"));

        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutJson(p.getId(), new BigDecimal("2"), new BigDecimal("25000"), "idem-1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.grandTotal").value(20000))
                .andExpect(jsonPath("$.data.paidTotal").value(25000))
                .andExpect(jsonPath("$.data.changeAmount").value(5000))
                .andExpect(jsonPath("$.data.invoiceNo").exists());

        // stock deducted
        var bal = balanceRepository.findById(p.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("8").compareTo(bal.getQty()));
    }

    @Test
    void checkout_withoutShift_rejected() throws Exception {
        String token = adminToken();
        Product p = createProduct("SKU-POS6", "Mie", new BigDecimal("3000"));
        setStock(p.getId(), new BigDecimal("10"));

        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutJson(p.getId(), BigDecimal.ONE, new BigDecimal("3000"), "idem-4")))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void checkout_emptyCart_rejected() throws Exception {
        String token = adminToken();
        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[],\"payments\":[{\"paymentMethodId\":1,\"amount\":1000}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_insufficientStock_rejected() throws Exception {
        String token = adminToken();
        openShift(token);
        Product p = createProduct("SKU-POS2", "Teh", new BigDecimal("5000"));
        setStock(p.getId(), new BigDecimal("1"));

        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutJson(p.getId(), new BigDecimal("5"), new BigDecimal("25000"), "idem-2")))
                .andExpect(status().isUnprocessableEntity());

        // stock unchanged
        var bal = balanceRepository.findById(p.getId()).orElseThrow();
        assertEquals(0, BigDecimal.ONE.compareTo(bal.getQty()));
    }

    @Test
    void checkout_doubleSubmit_idempotent() throws Exception {
        String token = adminToken();
        openShift(token);
        Product p = createProduct("SKU-POS3", "Gula", new BigDecimal("15000"));
        setStock(p.getId(), new BigDecimal("10"));

        String body = checkoutJson(p.getId(), BigDecimal.ONE, new BigDecimal("15000"), "idem-dup");
        var r1 = mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        String inv1 = om.readTree(r1.getResponse().getContentAsString()).path("data").path("invoiceNo").asText();

        var r2 = mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        String inv2 = om.readTree(r2.getResponse().getContentAsString()).path("data").path("invoiceNo").asText();

        assertEquals(inv1, inv2, "Double submit must return the same sale");
        // stock deducted only once
        var bal = balanceRepository.findById(p.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("9").compareTo(bal.getQty()));
    }

    @Test
    void hold_doesNotTouchStock() throws Exception {
        String token = adminToken();
        openShift(token);
        Product p = createProduct("SKU-POS4", "Susu", new BigDecimal("20000"));
        setStock(p.getId(), new BigDecimal("5"));

        var res = mockMvc.perform(post("/api/v1/sales/hold")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"productId\":" + p.getId() + ",\"qty\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("HELD")).andReturn();
        long holdId = om.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();

        // stock untouched
        var bal = balanceRepository.findById(p.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("5").compareTo(bal.getQty()));

        // resume completes and deducts
        mockMvc.perform(post("/api/v1/sales/" + holdId + "/resume")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutJson(p.getId(), new BigDecimal("2"), new BigDecimal("40000"), null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        var bal2 = balanceRepository.findById(p.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("3").compareTo(bal2.getQty()));
    }

    @Test
    void checkout_inactiveProduct_rejected() throws Exception {
        String token = adminToken();
        openShift(token);
        Product p = createProduct("SKU-POS5", "Roti", new BigDecimal("8000"));
        p.setActive(false);
        productRepository.save(p);

        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutJson(p.getId(), BigDecimal.ONE, new BigDecimal("8000"), "idem-3")))
                .andExpect(status().isUnprocessableEntity());
    }
}

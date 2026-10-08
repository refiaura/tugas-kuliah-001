package com.tugaskuliah.pos.inventory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.inventory.repository.StockMovementRepository;
import com.tugaskuliah.pos.masterdata.entity.Product;
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

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Inventory document flows against real PostgreSQL (profile "test").
 * Note: not runnable in this sandbox (no DB here); run on a dev machine with
 * {@code ./mvnw test -Dtest='StockIntegrationTest'}.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StockIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired InventoryBalanceRepository balanceRepository;
    @Autowired StockMovementRepository movementRepository;
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

    private Product createProduct(String sku, String name) {
        Unit pcs = unitRepository.findByCode("PCS").orElseThrow();
        Product p = new Product();
        p.setSku(sku);
        p.setName(name);
        p.setUnit(pcs);
        p.setPurchasePrice(new BigDecimal("10000"));
        p.setSellingPrice(new BigDecimal("15000"));
        p.setActive(true);
        return productRepository.save(p);
    }

    private void setStock(Long productId, BigDecimal qty) {
        InventoryBalance bal = new InventoryBalance();
        bal.setProduct(productRepository.findById(productId).orElseThrow());
        bal.setQty(qty);
        balanceRepository.save(bal);
    }

    private BigDecimal stockOf(Long productId) {
        return balanceRepository.findById(productId)
                .map(InventoryBalance::getQty).orElse(BigDecimal.ZERO);
    }

    private long movementCount(Long productId) {
        return movementRepository.findByProductIdOrderByCreatedAtDesc(
                productId, org.springframework.data.domain.Pageable.unpaged()).getTotalElements();
    }

    @Test
    void balances_listsStock() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-1", "Kopi Test");
        setStock(p.getId(), new BigDecimal("12"));

        mockMvc.perform(get("/api/v1/stock/balances")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].productId").value(p.getId().intValue()))
                .andExpect(jsonPath("$.data[0].qty", closeTo(12.0, 0.001)));
    }

    @Test
    void opname_noDiff_recordsDocWithoutMovement() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-2", "Teh Test");
        setStock(p.getId(), new BigDecimal("10"));

        mockMvc.perform(post("/api/v1/stock/opnames")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"Gudang\",\"lines\":[{\"productId\":" + p.getId()
                                + ",\"countedQty\":10}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists())
                .andExpect(jsonPath("$.data.lines[0].differenceQty", closeTo(0.0, 0.001)));

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("10")));
        assertEquals(0, movementCount(p.getId())); // no diff → no ledger entries
    }

    @Test
    void opname_withDiff_adjustsBalanceAndPostsMovement() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-3", "Gula Test");
        setStock(p.getId(), new BigDecimal("10"));

        mockMvc.perform(post("/api/v1/stock/opnames")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"Gudang\",\"lines\":[{\"productId\":" + p.getId()
                                + ",\"countedQty\":7}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.lines[0].expectedQty", closeTo(10.0, 0.001)))
                .andExpect(jsonPath("$.data.lines[0].differenceQty", closeTo(-3.0, 0.001)));

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("7")));
        assertEquals(1, movementCount(p.getId()));

        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + token)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("STOCK_OPNAME"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(-3.0, 0.001)));
    }

    @Test
    void adjustment_blankReason_rejected() throws Exception {
        // blank reason is rejected by bean validation (@NotBlank) with 400
        String token = adminToken();
        Product p = createProduct("STK-4", "Susu Test");
        setStock(p.getId(), new BigDecimal("5"));

        mockMvc.perform(post("/api/v1/stock/adjustments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":" + p.getId()
                                + ",\"qtyChange\":2,\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("5")));
        assertEquals(0, movementCount(p.getId()));
    }

    @Test
    void adjustment_negativeStock_rejected() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-5", "Roti Test");
        setStock(p.getId(), new BigDecimal("5"));

        mockMvc.perform(post("/api/v1/stock/adjustments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":" + p.getId()
                                + ",\"qtyChange\":-10,\"reason\":\"Koreksi rusak\"}"))
                .andExpect(status().isUnprocessableEntity());

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("5")));
        assertEquals(0, movementCount(p.getId()));
    }

    @Test
    void transfer_atomic_pairMovementsBalanceUnchanged() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-6", "Air Test");
        setStock(p.getId(), new BigDecimal("20"));

        mockMvc.perform(post("/api/v1/stock/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":" + p.getId()
                                + ",\"qty\":3,\"fromLocation\":\"Gudang A\",\"toLocation\":\"Toko B\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists());

        // total balance unchanged, one OUT + one IN movement
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("20")));
        assertEquals(2, movementCount(p.getId()));

        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + token)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.movementType=='TRANSFER_OUT')].qtyChange",
                        hasItem(closeTo(-3.0, 0.001))))
                .andExpect(jsonPath("$.data[?(@.movementType=='TRANSFER_IN')].qtyChange",
                        hasItem(closeTo(3.0, 0.001))));
    }

    @Test
    void transfer_sameLocation_rejected() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-7", "Mie Test");
        setStock(p.getId(), new BigDecimal("20"));

        mockMvc.perform(post("/api/v1/stock/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":" + p.getId()
                                + ",\"qty\":3,\"fromLocation\":\"Gudang A\",\"toLocation\":\"Gudang A\"}"))
                .andExpect(status().isUnprocessableEntity());

        assertEquals(0, movementCount(p.getId()));
    }

    @Test
    void receive_increasesBalanceAndPostsMovement() throws Exception {
        String token = adminToken();
        Product p = createProduct("STK-8", "Beras Test");
        setStock(p.getId(), new BigDecimal("5"));

        mockMvc.perform(post("/api/v1/stock/receipts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":" + p.getId()
                                + ",\"qty\":25,\"location\":\"Gudang\",\"supplierRef\":\"PO-001\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists());

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("30")));
        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + token)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("RECEIVE"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(25.0, 0.001)));
    }
}

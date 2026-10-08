package com.tugaskuliah.pos.control;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.closeTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Void / return / approval / audit flows against real PostgreSQL (profile "test").
 * Note: not runnable in this sandbox (no DB here); run on a dev machine with
 * {@code ./mvnw test -Dtest='ControlIntegrationTest'}.
 *
 * Roles: "admin" (OWNER, seeded) approves; "kasir1" (KASIR) requests void/return;
 * "owner2" (second OWNER) exercises the anti-self-approve rule (OWNER has
 * approval.approve, so the 422 path is reachable — a KASIR would get 403 first).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ControlIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired InventoryBalanceRepository balanceRepository;
    ObjectMapper om = new ObjectMapper();
    MockMvc mockMvc;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).apply(springSecurity()).build();
        String adminToken = login("admin", "admin123");
        createUser(adminToken, "kasir1", "kasir123", "KASIR");
        createUser(adminToken, "owner2", "owner2123", "OWNER");
    }

    private void createUser(String adminToken, String username, String password, String role) throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\","
                                + "\"fullName\":\"" + username + "\",\"roles\":[\"" + role + "\"]}"))
                .andExpect(status().isCreated());
    }

    private String login(String username, String password) throws Exception {
        var res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
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
        p.setPurchasePrice(new BigDecimal("9000"));
        p.setSellingPrice(new BigDecimal("15000"));
        p.setActive(true);
        return productRepository.save(p);
    }

    private void setStock(Long productId, BigDecimal qty) {
        InventoryBalance bal = new InventoryBalance();
        bal.setProduct(productRepository.findById(productId).orElseThrow());
        bal.setQty(qty);
        bal.setDamagedQty(BigDecimal.ZERO);
        balanceRepository.save(bal);
    }

    private void openShift(String token, String openingCash) throws Exception {
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":" + openingCash + "}"))
                .andExpect(status().isCreated());
    }

    private void closeShift(String token, String actualCash) throws Exception {
        mockMvc.perform(post("/api/v1/shifts/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actualCash\":" + actualCash + "}"))
                .andExpect(status().isOk());
    }

    /** Checkout qty units (CASH, exact); returns {saleId, saleItemId}. */
    private long[] checkout(String token, Long productId, int qty) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"productId\":" + productId + ",\"qty\":" + qty + "}],"
                                + "\"payments\":[{\"paymentMethodId\":1,\"amount\":" + (15000 * qty) + "}],"
                                + "\"idempotencyKey\":\"idem-" + productId + "-" + qty + "-" + System.nanoTime() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("COMPLETED")).andReturn();
        JsonNode data = om.readTree(res.getResponse().getContentAsString()).path("data");
        return new long[]{data.path("id").asLong(), data.path("items").get(0).path("id").asLong()};
    }

    private BigDecimal stockOf(Long productId) {
        return balanceRepository.findById(productId)
                .map(InventoryBalance::getQty).orElse(BigDecimal.ZERO);
    }

    private BigDecimal damagedOf(Long productId) {
        return balanceRepository.findById(productId)
                .map(InventoryBalance::getDamagedQty).orElse(BigDecimal.ZERO);
    }

    private long requestVoid(String token, long saleId, String reason) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/sales/" + saleId + "/void")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING")).andReturn();
        return om.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    private long[] requestReturn(String token, long saleId, long saleItemId,
                               String qty, String condition) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/sales/" + saleId + "/returns")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"barang cacat\",\"lines\":[{\"saleItemId\":" + saleItemId
                                + ",\"qty\":" + qty + ",\"condition\":\"" + condition + "\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING")).andReturn();
        JsonNode data = om.readTree(res.getResponse().getContentAsString()).path("data");
        return new long[]{data.path("id").asLong(), data.path("approvalId").asLong()};
    }

    private String saleStatus(String token, long saleId) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/sales/" + saleId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(res.getResponse().getContentAsString()).path("data").path("status").asText();
    }

    private void decide(String token, long approvalId, boolean approve, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/v1/approvals/" + approvalId + (approve ? "/approve" : "/reject"))
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is(expectedStatus));
    }

    private boolean auditActionExists(String token, String entityType, String action) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/audit-logs")
                        .header("Authorization", "Bearer " + token)
                        .param("entityType", entityType)
                        .param("size", "100"))
                .andExpect(status().isOk()).andReturn();
        JsonNode data = om.readTree(res.getResponse().getContentAsString()).path("data");
        for (JsonNode n : data) {
            if (action.equals(n.path("action").asText())) {
                return true;
            }
        }
        return false;
    }

    // ---------- void ----------

    @Test
    void void_requiresApproval_saleStaysCompletedUntilApproved() throws Exception {
        String admin = login("admin", "admin123");
        String kasir = login("kasir1", "kasir123");
        Product p = createProduct("CTL-1", "Kopi Void");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasir, "500000");

        long[] ids = checkout(kasir, p.getId(), 2);
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("8")));

        requestVoid(kasir, ids[0], "salah input");
        // without approval: sale still COMPLETED, stock untouched
        assertEquals("COMPLETED", saleStatus(kasir, ids[0]));
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("8")));
    }

    @Test
    void selfApprove_rejected() throws Exception {
        String admin = login("admin", "admin123");
        String owner2 = login("owner2", "owner2123");
        Product p = createProduct("CTL-2", "Kopi SelfApprove");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(owner2, "500000");

        long[] ids = checkout(owner2, p.getId(), 1);
        long approvalId = requestVoid(owner2, ids[0], "test self approve");
        // requester approves their own request -> 422
        decide(owner2, approvalId, true, 422);
        assertEquals("COMPLETED", saleStatus(owner2, ids[0]));
        // another owner can approve instead
        decide(admin, approvalId, true, 200);
        assertEquals("VOIDED", saleStatus(admin, ids[0]));
    }

    @Test
    void voidExecution_reversesStockAndAudits() throws Exception {
        String admin = login("admin", "admin123");
        String kasir = login("kasir1", "kasir123");
        Product p = createProduct("CTL-3", "Kopi VoidExec");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasir, "500000");

        long[] ids = checkout(kasir, p.getId(), 3);
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("7")));

        long approvalId = requestVoid(kasir, ids[0], "double charge");
        decide(admin, approvalId, true, 200);

        assertEquals("VOIDED", saleStatus(admin, ids[0]));
        // stock restored to original 10
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("10")));
        // reversal movement (VOID, positive qty) on the ledger
        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + admin)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("VOID"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(3.0, 0.001)));
        // audit recorded
        assertTrue(auditActionExists(admin, "SALE", "SALE_VOID_EXECUTED"));
    }

    // ---------- return ----------

    @Test
    void returnSellable_addsToNormalBalance() throws Exception {
        String admin = login("admin", "admin123");
        String kasir = login("kasir1", "kasir123");
        Product p = createProduct("CTL-4", "Kopi ReturnSell");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasir, "500000");
        openShift(admin, "1000000"); // approver needs an open shift for the cash refund

        long[] ids = checkout(kasir, p.getId(), 3);
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("7")));

        long[] ret = requestReturn(kasir, ids[0], ids[1], "1", "SELLABLE");
        decide(admin, ret[1], true, 200);

        // SELLABLE -> normal balance grows, damaged untouched
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("8")));
        assertEquals(0, damagedOf(p.getId()).compareTo(BigDecimal.ZERO));
        // movement SALE_RETURN on the ledger
        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + admin)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("SALE_RETURN"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(1.0, 0.001)));
        // refund 1 x 15000 posted as REFUND cash movement on the approver's shift
        MvcResult retRes = mockMvc.perform(get("/api/v1/sales/returns/" + ret[0])
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED")).andReturn();
        long shiftId = om.readTree(retRes.getResponse().getContentAsString())
                .path("data").path("shiftId").asLong();
        mockMvc.perform(get("/api/v1/shifts/" + shiftId + "/summary")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cashOut", closeTo(15000.0, 0.001)));
        assertTrue(auditActionExists(admin, "SALE_RETURN", "SALE_RETURN_EXECUTED"));
    }

    @Test
    void returnDamaged_goesToDamagedBucket() throws Exception {
        String admin = login("admin", "admin123");
        String kasir = login("kasir1", "kasir123");
        Product p = createProduct("CTL-5", "Kopi ReturnDmg");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasir, "500000");
        openShift(admin, "1000000");

        long[] ids = checkout(kasir, p.getId(), 3);
        long[] ret = requestReturn(kasir, ids[0], ids[1], "2", "DAMAGED");
        decide(admin, ret[1], true, 200);

        // DAMAGED -> normal balance unchanged, damaged bucket grows
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("7")));
        assertEquals(0, damagedOf(p.getId()).compareTo(new BigDecimal("2")));
    }

    @Test
    void returnMoreThanSold_rejected() throws Exception {
        String kasir = login("kasir1", "kasir123");
        Product p = createProduct("CTL-6", "Kopi ReturnOver");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasir, "500000");

        long[] ids = checkout(kasir, p.getId(), 2);
        // try to return 5 of 2 sold -> 422
        mockMvc.perform(post("/api/v1/sales/" + ids[0] + "/returns")
                        .header("Authorization", "Bearer " + kasir)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"coba\",\"lines\":[{\"saleItemId\":" + ids[1]
                                + ",\"qty\":5,\"condition\":\"SELLABLE\"}]}"))
                .andExpect(status().is(422));
    }

    // ---------- audit ----------

    @Test
    void priceChange_audited() throws Exception {
        String admin = login("admin", "admin123");
        Product p = createProduct("CTL-7", "Kopi PriceAudit");

        mockMvc.perform(put("/api/v1/products/" + p.getId() + "/price")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sellingPrice\":16000,\"reason\":\"naik\"}"))
                .andExpect(status().isOk());

        assertTrue(auditActionExists(admin, "PRODUCT", "PRICE_CHANGE"));
    }

    // ---------- shift variance ----------

    @Test
    void shiftVariance_createsApprovalRequest() throws Exception {
        String admin = login("admin", "admin123");
        String kasir = login("kasir1", "kasir123");
        openShift(kasir, "500000");
        // close with |variance| = 100000 > 50000 threshold
        closeShift(kasir, "400000");

        MvcResult res = mockMvc.perform(get("/api/v1/approvals")
                        .header("Authorization", "Bearer " + admin)
                        .param("status", "PENDING")
                        .param("size", "100"))
                .andExpect(status().isOk()).andReturn();
        JsonNode data = om.readTree(res.getResponse().getContentAsString()).path("data");
        boolean found = false;
        for (JsonNode n : data) {
            if ("SHIFT_VARIANCE".equals(n.path("subjectType").asText())) {
                found = true;
            }
        }
        assertTrue(found, "SHIFT_VARIANCE approval request should exist");
    }
}

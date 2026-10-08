package com.tugaskuliah.pos.purchase;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.closeTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Purchase flows against real PostgreSQL (profile "test").
 * Note: not runnable in this sandbox (no DB here); run on a dev machine with
 * {@code ./mvnw test -Dtest='PurchaseIntegrationTest'}.
 *
 * Roles: "admin" (OWNER) approves; a second OWNER user ("purchaser") creates
 * and submits POs, so the self-approval rule can be exercised both ways.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PurchaseIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired InventoryBalanceRepository balanceRepository;
    @Autowired StockMovementRepository movementRepository;
    ObjectMapper om = new ObjectMapper();
    MockMvc mockMvc;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).apply(springSecurity()).build();
        String adminToken = login("admin", "admin123");
        // second user with full rights, used as PO requester
        mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"purchaser\",\"password\":\"purchaser123\","
                                + "\"fullName\":\"Purchaser\",\"email\":\"purchaser@local\","
                                + "\"phone\":null,\"roles\":[\"OWNER\"]}"))
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

    private Long createSupplier(String token, String code, String name) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/suppliers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"supplierCode\":\"" + code + "\",\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        return om.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    /** Creates a DRAFT PO; returns {poId, poLineId}. */
    private long[] createPo(String token, Long supplierId, Long productId, String qty, String price) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/purchases/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"supplierId\":" + supplierId + ",\"notes\":\"test\","
                                + "\"lines\":[{\"productId\":" + productId
                                + ",\"qty\":" + qty + ",\"unitPrice\":" + price + "}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists())
                .andExpect(jsonPath("$.data.status").value("DRAFT")).andReturn();
        JsonNode data = om.readTree(res.getResponse().getContentAsString()).path("data");
        return new long[]{data.path("id").asLong(), data.path("lines").get(0).path("id").asLong()};
    }

    private String poStatus(String token, long poId) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/purchases/orders/" + poId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(res.getResponse().getContentAsString()).path("data").path("status").asText();
    }

    private void submitApproveOrder(String requester, String approver, long poId) throws Exception {
        mockMvc.perform(post("/api/v1/purchases/orders/" + poId + "/submit")
                        .header("Authorization", "Bearer " + requester))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
        mockMvc.perform(post("/api/v1/purchases/orders/" + poId + "/approve")
                        .header("Authorization", "Bearer " + approver))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.approvedBy").value("admin"));
        mockMvc.perform(post("/api/v1/purchases/orders/" + poId + "/mark-ordered")
                        .header("Authorization", "Bearer " + requester))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ORDERED"));
    }

    private void receive(String token, long poId, long poLineId, String qty) throws Exception {
        mockMvc.perform(post("/api/v1/purchases/receipts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"poId\":" + poId + ","
                                + "\"lines\":[{\"poLineId\":" + poLineId
                                + ",\"receivedQty\":" + qty + "}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists());
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
    void poLifecycle_noStockChangeUntilReceipt() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-1", "Kopi PO");
        Long supplierId = createSupplier(admin, "SUP-1", "Supplier Satu");

        long[] ids = createPo(requester, supplierId, p.getId(), "100", "9000");
        submitApproveOrder(requester, admin, ids[0]);

        // PO lifecycle adds NO stock and NO movements
        assertEquals(0, stockOf(p.getId()).compareTo(BigDecimal.ZERO));
        assertEquals(0, movementCount(p.getId()));
    }

    @Test
    void partialReceipt_addsStockAndAdvancesStatus() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-2", "Gula PO");
        Long supplierId = createSupplier(admin, "SUP-2", "Supplier Dua");

        long[] ids = createPo(requester, supplierId, p.getId(), "100", "9000");
        submitApproveOrder(requester, admin, ids[0]);

        // partial receipt #1: 40 of 100
        receive(requester, ids[0], ids[1], "40");
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("40")));
        assertEquals("PARTIALLY_RECEIVED", poStatus(requester, ids[0]));

        // partial receipt #2: remaining 60 → RECEIVED
        receive(requester, ids[0], ids[1], "60");
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("100")));
        assertEquals("RECEIVED", poStatus(requester, ids[0]));

        // two PURCHASE movements on the ledger
        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + admin)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("PURCHASE"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(60.0, 0.001)))
                .andExpect(jsonPath("$.data[1].movementType").value("PURCHASE"))
                .andExpect(jsonPath("$.data[1].qtyChange", closeTo(40.0, 0.001)));
    }

    @Test
    void receiveMoreThanOrdered_rejected() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-3", "Teh PO");
        Long supplierId = createSupplier(admin, "SUP-3", "Supplier Tiga");

        long[] ids = createPo(requester, supplierId, p.getId(), "100", "9000");
        submitApproveOrder(requester, admin, ids[0]);
        receive(requester, ids[0], ids[1], "60");

        // 60 received, another 50 would exceed 100 → 422
        mockMvc.perform(post("/api/v1/purchases/receipts")
                        .header("Authorization", "Bearer " + requester)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"poId\":" + ids[0] + ","
                                + "\"lines\":[{\"poLineId\":" + ids[1] + ",\"receivedQty\":50}]}"))
                .andExpect(status().isUnprocessableEntity());

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("60")));
    }

    @Test
    void selfApprove_rejected() throws Exception {
        String admin = login("admin", "admin123");
        Product p = createProduct("PO-4", "Susu PO");
        Long supplierId = createSupplier(admin, "SUP-4", "Supplier Empat");

        // admin creates and submits its own PO…
        long[] ids = createPo(admin, supplierId, p.getId(), "10", "9000");
        mockMvc.perform(post("/api/v1/purchases/orders/" + ids[0] + "/submit")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        // …then tries to approve it: forbidden (business rule, M7 foreshadow)
        mockMvc.perform(post("/api/v1/purchases/orders/" + ids[0] + "/approve")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isUnprocessableEntity());

        assertEquals("SUBMITTED", poStatus(admin, ids[0]));
    }

    @Test
    void cancelApproved_rejected() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-5", "Roti PO");
        Long supplierId = createSupplier(admin, "SUP-5", "Supplier Lima");

        long[] ids = createPo(requester, supplierId, p.getId(), "10", "9000");
        submitApproveOrder(requester, admin, ids[0]);

        // approved (ordered) PO cannot be cancelled
        mockMvc.perform(post("/api/v1/purchases/orders/" + ids[0] + "/cancel")
                        .header("Authorization", "Bearer " + requester))
                .andExpect(status().isUnprocessableEntity());

        assertEquals("ORDERED", poStatus(requester, ids[0]));
    }

    @Test
    void cancelDraft_allowed() throws Exception {
        String requester = login("purchaser", "purchaser123");
        String admin = login("admin", "admin123");
        Product p = createProduct("PO-6", "Air PO");
        Long supplierId = createSupplier(admin, "SUP-6", "Supplier Enam");

        long[] ids = createPo(requester, supplierId, p.getId(), "10", "9000");
        mockMvc.perform(post("/api/v1/purchases/orders/" + ids[0] + "/cancel")
                        .header("Authorization", "Bearer " + requester))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    @Test
    void purchaseReturn_reducesStockAndCreditsSupplier() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-7", "Beras PO");
        Long supplierId = createSupplier(admin, "SUP-7", "Supplier Tujuh");

        long[] ids = createPo(requester, supplierId, p.getId(), "100", "9000");
        submitApproveOrder(requester, admin, ids[0]);
        receive(requester, ids[0], ids[1], "100");
        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("100")));

        // return 20 of 100: stock out + supplier credit 20 * 9000
        mockMvc.perform(post("/api/v1/purchases/returns")
                        .header("Authorization", "Bearer " + requester)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"poId\":" + ids[0] + ",\"reason\":\"Kemasan rusak\","
                                + "\"lines\":[{\"poLineId\":" + ids[1] + ",\"qty\":20}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.docNo").exists())
                .andExpect(jsonPath("$.data.supplierCredit", closeTo(180000.0, 0.01)));

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("80")));
        mockMvc.perform(get("/api/v1/stock/movements")
                        .header("Authorization", "Bearer " + admin)
                        .param("productId", p.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].movementType").value("PURCHASE_RETURN"))
                .andExpect(jsonPath("$.data[0].qtyChange", closeTo(-20.0, 0.001)));
    }

    @Test
    void returnMoreThanReceived_rejected() throws Exception {
        String admin = login("admin", "admin123");
        String requester = login("purchaser", "purchaser123");
        Product p = createProduct("PO-8", "Mie PO");
        Long supplierId = createSupplier(admin, "SUP-8", "Supplier Delapan");

        long[] ids = createPo(requester, supplierId, p.getId(), "100", "9000");
        submitApproveOrder(requester, admin, ids[0]);
        receive(requester, ids[0], ids[1], "100");

        // cannot return 150 when only 100 were received
        mockMvc.perform(post("/api/v1/purchases/returns")
                        .header("Authorization", "Bearer " + requester)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"poId\":" + ids[0] + ",\"reason\":\"Kelebihan\","
                                + "\"lines\":[{\"poLineId\":" + ids[1] + ",\"qty\":150}]}"))
                .andExpect(status().isUnprocessableEntity());

        assertEquals(0, stockOf(p.getId()).compareTo(new BigDecimal("100")));
    }
}

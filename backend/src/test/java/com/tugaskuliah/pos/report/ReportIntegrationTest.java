package com.tugaskuliah.pos.report;

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
import java.time.LocalDate;

import static com.tugaskuliah.pos.TestMatchers.closeToNumber;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Dashboard / reports / notifications against real PostgreSQL (profile "test").
 * Note: not runnable in this sandbox (no DB here); run on a dev machine with
 * {@code ./mvnw test -Dtest='ReportIntegrationTest'}.
 *
 * "admin" (OWNER, seeded) has all report.* authorities; "kasir1" (KASIR) has
 * notification.view (granted in V10) but no report.* authorities.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReportIntegrationTest {

    @Autowired WebApplicationContext wac;
    @Autowired ProductRepository productRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired InventoryBalanceRepository balanceRepository;
    ObjectMapper om = new ObjectMapper();
    MockMvc mockMvc;

    String adminToken;
    String kasirToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).apply(springSecurity()).build();
        adminToken = login("admin", "admin123");
        createUser(adminToken, "kasir1", "kasir123", "KASIR");
        kasirToken = login("kasir1", "kasir123");
    }

    // ---------- helpers ----------

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

    private Product createProduct(String sku, String name, String purchasePrice, String minStock) {
        Unit pcs = unitRepository.findByCode("PCS").orElseThrow();
        Product p = new Product();
        p.setSku(sku);
        p.setName(name);
        p.setUnit(pcs);
        p.setPurchasePrice(new BigDecimal(purchasePrice));
        p.setSellingPrice(new BigDecimal("15000"));
        p.setMinimumStock(new BigDecimal(minStock));
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

    private void openShift(String token) throws Exception {
        mockMvc.perform(post("/api/v1/shifts/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingCash\":100000}"))
                .andExpect(status().isCreated());
    }

    /** Checkout qty units at Rp15.000 via CASH (paymentMethodId 1 = seeded CASH). */
    private void checkout(String token, Long productId, int qty) throws Exception {
        mockMvc.perform(post("/api/v1/sales/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"productId\":" + productId + ",\"qty\":" + qty + "}],"
                                + "\"payments\":[{\"paymentMethodId\":1,\"amount\":" + (15000 * qty) + "}],"
                                + "\"idempotencyKey\":\"idem-" + productId + "-" + qty + "-" + System.nanoTime() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    private long unreadCount(String token) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(res.getResponse().getContentAsString())
                .path("data").path("unreadCount").asLong();
    }

    // ---------- tests ----------

    @Test
    void dashboardKpiCorrect() throws Exception {
        Product p = createProduct("DSH-001", "KPI Product", "9000", "5");
        setStock(p.getId(), new BigDecimal("100"));
        openShift(kasirToken);
        checkout(kasirToken, p.getId(), 2); // Rp30.000

        mockMvc.perform(get("/api/v1/dashboard")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sales.revenueToday", closeToNumber(30000, 0.01)))
                .andExpect(jsonPath("$.data.sales.transactionCount").value(1))
                .andExpect(jsonPath("$.data.sales.itemsSold", closeToNumber(2, 0.01)))
                .andExpect(jsonPath("$.data.sales.averageTransactionValue", closeToNumber(30000, 0.01)))
                // gross profit = 30000 - 2*9000 = 12000
                .andExpect(jsonPath("$.data.sales.grossProfitToday", closeToNumber(12000, 0.01)))
                .andExpect(jsonPath("$.data.inventory.totalActiveSku", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.cash.activeShiftCount").value(1));
    }

    @Test
    void kasirCannotAccessReports() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isForbidden());
        // ...but CAN read notifications (V10 grant)
        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isOk());
    }

    @Test
    void salesReportDateFilter() throws Exception {
        Product p = createProduct("SRF-001", "Filter Product", "9000", "0");
        setStock(p.getId(), new BigDecimal("100"));
        openShift(kasirToken);
        checkout(kasirToken, p.getId(), 1);

        String today = LocalDate.now().toString();
        String tomorrow = LocalDate.now().plusDays(1).toString();

        mockMvc.perform(get("/api/v1/reports/sales")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("startDate", today).param("endDate", today))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalElements").value(1))
                .andExpect(jsonPath("$.data[0].grandTotal", closeToNumber(15000, 0.01)))
                .andExpect(jsonPath("$.data[0].status").value("COMPLETED"));

        // future range -> empty
        mockMvc.perform(get("/api/v1/reports/sales")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("startDate", tomorrow).param("endDate", tomorrow))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalElements").value(0));
    }

    @Test
    void productReportAggregates() throws Exception {
        Product p = createProduct("PRD-001", "Aggregate Product", "9000", "0");
        setStock(p.getId(), new BigDecimal("100"));
        openShift(kasirToken);
        checkout(kasirToken, p.getId(), 3); // Rp45.000

        mockMvc.perform(get("/api/v1/reports/products")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sku").value("PRD-001"))
                .andExpect(jsonPath("$.data[0].qtySold", closeToNumber(3, 0.01)))
                .andExpect(jsonPath("$.data[0].revenue", closeToNumber(45000, 0.01)))
                .andExpect(jsonPath("$.data[0].netSales", closeToNumber(45000, 0.01)));
    }

    @Test
    void profitReportCogsEstimatedFlag() throws Exception {
        Product withCost = createProduct("PF2-001", "Costed2", "9000", "0");
        Product noCost = createProduct("PF2-002", "NoCost2", "0", "0");
        setStock(withCost.getId(), new BigDecimal("100"));
        setStock(noCost.getId(), new BigDecimal("100"));
        openShift(kasirToken);

        checkout(kasirToken, withCost.getId(), 2); // revenue 30000, cogs 18000, not estimated
        MvcResult r1 = mockMvc.perform(get("/api/v1/reports/profit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode d1 = om.readTree(r1.getResponse().getContentAsString()).path("data");
        assertTrue(!d1.path("cogsEstimated").asBoolean(), "cogsEstimated should be false");
        assertEquals(0, new BigDecimal(d1.path("cogs").asText()).compareTo(new BigDecimal("18000")));
        assertEquals(0, new BigDecimal(d1.path("grossProfit").asText()).compareTo(new BigDecimal("12000")));

        checkout(kasirToken, noCost.getId(), 1); // revenue +15000, cost unknown -> estimated
        MvcResult r2 = mockMvc.perform(get("/api/v1/reports/profit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode d2 = om.readTree(r2.getResponse().getContentAsString()).path("data");
        assertTrue(d2.path("cogsEstimated").asBoolean(), "cogsEstimated should be true");
        assertEquals(0, new BigDecimal(d2.path("netSales").asText()).compareTo(new BigDecimal("45000")));
    }

    @Test
    void lowStockNotificationCreatedAfterCheckout() throws Exception {
        Product p = createProduct("NTF-001", "Low Product", "9000", "10");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasirToken);

        long before = unreadCount(kasirToken);
        checkout(kasirToken, p.getId(), 1); // stock 9 <= min 10 -> LOW_STOCK
        assertEquals(before + 1, unreadCount(kasirToken));

        // second checkout: dedup within 24h -> no new notification
        checkout(kasirToken, p.getId(), 1);
        assertEquals(before + 1, unreadCount(kasirToken));

        // notification is visible with LOW_STOCK type
        MvcResult res = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isOk()).andReturn();
        String body = res.getResponse().getContentAsString();
        assertTrue(body.contains("LOW_STOCK"), "expected LOW_STOCK notification, got: " + body);
    }

    @Test
    void markReadReducesUnreadCount() throws Exception {
        Product p = createProduct("NTF-002", "Read Product", "9000", "10");
        setStock(p.getId(), new BigDecimal("10"));
        openShift(kasirToken);
        checkout(kasirToken, p.getId(), 1);

        long before = unreadCount(kasirToken);
        assertTrue(before >= 1);

        MvcResult list = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isOk()).andReturn();
        long notifId = om.readTree(list.getResponse().getContentAsString())
                .path("data").get(0).path("id").asLong();

        mockMvc.perform(post("/api/v1/notifications/" + notifId + "/read")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.read").value(true));

        assertEquals(before - 1, unreadCount(kasirToken));

        // read-all clears the rest
        mockMvc.perform(post("/api/v1/notifications/read-all")
                        .header("Authorization", "Bearer " + kasirToken))
                .andExpect(status().isOk());
        assertEquals(0, unreadCount(kasirToken));
    }

    // ---------- export ----------

    @Test
    void salesExportXlsx_returnsFile() throws Exception {
        Product p = createProduct("EXP-001", "Export Product", "9000", "0");
        setStock(p.getId(), new BigDecimal("100"));
        openShift(kasirToken);
        checkout(kasirToken, p.getId(), 1);

        MvcResult res = mockMvc.perform(get("/api/v1/reports/sales/export")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("format", "xlsx"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andReturn();

        String disposition = res.getResponse().getHeader("Content-Disposition");
        assertTrue(disposition != null && disposition.contains("attachment"),
                "expected attachment disposition, got: " + disposition);
        assertTrue(disposition.contains("laporan-penjualan-"),
                "expected laporan-penjualan filename, got: " + disposition);
        assertTrue(res.getResponse().getContentAsByteArray().length > 0,
                "expected non-empty xlsx bytes");
    }

    @Test
    void salesExportCsv_hasBomAndHeader() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/reports/sales/export")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("format", "csv"))
                .andExpect(status().isOk())
                .andReturn();

        byte[] bytes = res.getResponse().getContentAsByteArray();
        assertTrue(bytes.length >= 3, "expected BOM + content");
        // UTF-8 BOM
        assertEquals((byte) 0xEF, bytes[0]);
        assertEquals((byte) 0xBB, bytes[1]);
        assertEquals((byte) 0xBF, bytes[2]);

        String body = new String(bytes, 3, bytes.length - 3, java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(body.startsWith("No. Invoice,"), "expected CSV header, got: " + body.substring(0, Math.min(60, body.length())));
    }

    @Test
    void productsExportPdf_returnsPdf() throws Exception {
        mockMvc.perform(get("/api/v1/reports/products/export")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("format", "pdf"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"));
    }

    @Test
    void profitExportXlsx_returnsFile() throws Exception {
        mockMvc.perform(get("/api/v1/reports/profit/export")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("format", "xlsx"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    @Test
    void kasirCannotExportReports() throws Exception {
        mockMvc.perform(get("/api/v1/reports/sales/export")
                        .header("Authorization", "Bearer " + kasirToken)
                        .param("format", "xlsx"))
                .andExpect(status().isForbidden());
    }

    @Test
    void exportInvalidFormat_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/reports/sales/export")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("format", "exe"))
                .andExpect(status().isBadRequest());
    }
}

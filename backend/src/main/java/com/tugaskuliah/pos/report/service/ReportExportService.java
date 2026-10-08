package com.tugaskuliah.pos.report.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;

/**
 * Generates report files (XLSX / PDF / CSV) from report row data.
 * Formatting follows Indonesian conventions: dd-MM-yyyy dates,
 * Rupiah without decimals, UTF-8 BOM on CSV for Excel compatibility.
 */
@Service
@RequiredArgsConstructor
public class ReportExportService {

    private static final Locale ID = new Locale("id", "ID");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm");

    /** Supported export formats. */
    public enum Format {
        XLSX, PDF, CSV;

        public static Format from(String s) {
            if (s == null) {
                return XLSX;
            }
            try {
                return Format.valueOf(s.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Format tidak didukung: " + s + " (xlsx|pdf|csv)");
            }
        }

        public String contentType() {
            return switch (this) {
                case XLSX -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                case PDF -> "application/pdf";
                case CSV -> "text/csv";
            };
        }

        public String extension() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /** Column definition: header label + value extractor + numeric flag. */
    public record Column<T>(String header, Function<T, Object> value, boolean numeric) {
        public static <T> Column<T> text(String header, Function<T, Object> value) {
            return new Column<>(header, value, false);
        }

        public static <T> Column<T> money(String header, Function<T, BigDecimal> value) {
            return new Column<>(header, v -> value.apply(v), true);
        }

        public static <T> Column<T> number(String header, Function<T, BigDecimal> value) {
            return new Column<>(header, v -> value.apply(v), true);
        }
    }

    /** Result of an export: file bytes + suggested filename. */
    public record ExportResult(byte[] bytes, String filename, String contentType) {
    }

    // ------------------------------------------------------------------
    // public API
    // ------------------------------------------------------------------

    public <T> ExportResult export(String reportSlug, String title,
                                  LocalDate startDate, LocalDate endDate,
                                  List<Column<T>> columns, List<T> rows,
                                  Format format) {
        String period = periodLabel(startDate, endDate);
        String dateSuffix = LocalDate.now().toString();
        String filename = "laporan-" + reportSlug + "-" + dateSuffix + "." + format.extension();
        byte[] bytes = switch (format) {
            case XLSX -> toXlsx(title, period, columns, rows);
            case PDF -> toPdf(title, period, columns, rows);
            case CSV -> toCsv(columns, rows);
        };
        return new ExportResult(bytes, filename, format.contentType());
    }

    // ------------------------------------------------------------------
    // formatting helpers
    // ------------------------------------------------------------------

    public static String fmtMoney(BigDecimal v) {
        if (v == null) {
            return "-";
        }
        NumberFormat nf = NumberFormat.getNumberInstance(ID);
        nf.setMaximumFractionDigits(0);
        return "Rp" + nf.format(v);
    }

    public static String fmtNumber(BigDecimal v) {
        if (v == null) {
            return "-";
        }
        NumberFormat nf = NumberFormat.getNumberInstance(ID);
        nf.setMaximumFractionDigits(2);
        return nf.format(v);
    }

    public static String fmtDate(OffsetDateTime v) {
        return v == null ? "-" : v.format(DATE_FMT);
    }

    public static String fmtDateTime(OffsetDateTime v) {
        return v == null ? "-" : v.format(DATETIME_FMT);
    }

    public static String str(Object v) {
        return v == null ? "-" : String.valueOf(v);
    }

    private static String periodLabel(LocalDate start, LocalDate end) {
        if (start == null && end == null) {
            return "Semua periode";
        }
        String s = start == null ? "..." : start.format(DATE_FMT);
        String e = end == null ? "..." : end.format(DATE_FMT);
        return s + " s/d " + e;
    }

    // ------------------------------------------------------------------
    // XLSX (Apache POI)
    // ------------------------------------------------------------------

    private <T> byte[] toXlsx(String title, String period, List<Column<T>> columns, List<T> rows) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Laporan");

            DataFormat df = wb.createDataFormat();
            CellStyle headerStyle = wb.createCellStyle();
            org.apache.poi.ss.usermodel.Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            CellStyle moneyStyle = wb.createCellStyle();
            moneyStyle.setDataFormat(df.getFormat("#,##0"));

            int r = 0;
            Row titleRow = sheet.createRow(r++);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(title);
            titleCell.setCellStyle(headerStyle);

            Row periodRow = sheet.createRow(r++);
            periodRow.createCell(0).setCellValue("Periode: " + period);
            r++; // blank row

            Row headerRow = sheet.createRow(r++);
            for (int c = 0; c < columns.size(); c++) {
                Cell cell = headerRow.createCell(c);
                cell.setCellValue(columns.get(c).header());
                cell.setCellStyle(headerStyle);
            }

            for (T rowData : rows) {
                Row row = sheet.createRow(r++);
                for (int c = 0; c < columns.size(); c++) {
                    Column<T> col = columns.get(c);
                    Object val = col.value().apply(rowData);
                    Cell cell = row.createCell(c);
                    if (val instanceof BigDecimal bd) {
                        cell.setCellValue(bd.doubleValue());
                        if (col.numeric()) {
                            cell.setCellStyle(moneyStyle);
                        }
                    } else if (val instanceof Number n) {
                        cell.setCellValue(n.doubleValue());
                    } else {
                        cell.setCellValue(str(val));
                    }
                }
            }

            for (int c = 0; c < columns.size(); c++) {
                sheet.autoSizeColumn(c);
                // cap width so one long column doesn't blow out the sheet
                if (sheet.getColumnWidth(c) > 40 * 256) {
                    sheet.setColumnWidth(c, 40 * 256);
                }
            }

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Gagal membuat file Excel: " + e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------
    // PDF (OpenPDF)
    // ------------------------------------------------------------------

    private <T> byte[] toPdf(String title, String period, List<Column<T>> columns, List<T> rows) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 36, 36, 48, 48);
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
            Font subFont = FontFactory.getFont(FontFactory.HELVETICA, 10);
            Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
            Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 9);

            Paragraph pTitle = new Paragraph(title, titleFont);
            pTitle.setAlignment(Element.ALIGN_CENTER);
            doc.add(pTitle);

            Paragraph pPeriod = new Paragraph("Periode: " + period, subFont);
            pPeriod.setAlignment(Element.ALIGN_CENTER);
            pPeriod.setSpacingAfter(16);
            doc.add(pPeriod);

            PdfPTable table = new PdfPTable(columns.size());
            table.setWidthPercentage(100);
            table.setHeaderRows(1);

            for (Column<T> col : columns) {
                PdfPCell hc = new PdfPCell(new Phrase(col.header(), headFont));
                hc.setHorizontalAlignment(Element.ALIGN_CENTER);
                hc.setPadding(6);
                table.addCell(hc);
            }

            for (T rowData : rows) {
                for (Column<T> col : columns) {
                    Object val = col.value().apply(rowData);
                    String text;
                    if (val instanceof BigDecimal bd) {
                        text = col.numeric() ? fmtMoney(bd) : fmtNumber(bd);
                    } else {
                        text = str(val);
                    }
                    PdfPCell cell = new PdfPCell(new Phrase(text, cellFont));
                    cell.setPadding(4);
                    if (col.numeric()) {
                        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    }
                    table.addCell(cell);
                }
            }

            doc.add(table);

            Paragraph footer = new Paragraph(
                    "Dicetak: " + OffsetDateTime.now().format(DATETIME_FMT),
                    subFont);
            footer.setAlignment(Element.ALIGN_RIGHT);
            footer.setSpacingBefore(16);
            doc.add(footer);

            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Gagal membuat file PDF: " + e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------
    // CSV (UTF-8 with BOM)
    // ------------------------------------------------------------------

    private <T> byte[] toCsv(List<Column<T>> columns, List<T> rows) {
        StringBuilder sb = new StringBuilder();
        // header
        for (int i = 0; i < columns.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(csvEscape(columns.get(i).header()));
        }
        sb.append("\r\n");
        // rows
        for (T rowData : rows) {
            for (int i = 0; i < columns.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                Column<T> col = columns.get(i);
                Object val = col.value().apply(rowData);
                String text;
                if (val instanceof BigDecimal bd) {
                    // raw number (no Rp prefix) so Excel treats it as numeric
                    text = bd.toPlainString();
                } else {
                    text = str(val).equals("-") ? "" : str(val);
                }
                sb.append(csvEscape(text));
            }
            sb.append("\r\n");
        }
        // BOM for Excel Indonesia
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, result, 0, bom.length);
        System.arraycopy(body, 0, result, bom.length, body.length);
        return result;
    }

    private static String csvEscape(String s) {
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}

package com.tugaskuliah.pos.inventory.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

@Entity
@Table(name = "document_counters")
@Getter
@Setter
@NoArgsConstructor
public class DocumentCounter {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Pk implements Serializable {
        @Column(name = "doc_type", length = 20)
        private String docType;
        @Column(name = "doc_date")
        private LocalDate docDate;

        public Pk(String docType, LocalDate docDate) {
            this.docType = docType;
            this.docDate = docDate;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return Objects.equals(docType, pk.docType) && Objects.equals(docDate, pk.docDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(docType, docDate);
        }
    }

    @EmbeddedId
    private Pk id;

    @Column(name = "last_number", nullable = false)
    private int lastNumber;
}

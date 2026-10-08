/**
 * Cashier shift screen.
 *
 * - No open shift + has shift.open: form to open a shift (opening cash).
 * - Open shift: live summary (cash sales, cash in/out, expected cash),
 *   cash-in/cash-out modal, and a button to go to the close-shift screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useShiftStore } from '../../stores/shiftStore';
import {
  cashMovement,
  getShiftSummary,
  openShift,
  ShiftSummary,
} from '../../services/shiftApi';
import { formatRupiah } from '../../stores/cartStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Shift'>;

function parseAmount(text: string): number | null {
  const n = Number(text.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ShiftScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const currentShift = useShiftStore(s => s.currentShift);
  const shiftLoading = useShiftStore(s => s.loading);
  const fetchCurrent = useShiftStore(s => s.fetchCurrent);
  const setCurrentShift = useShiftStore(s => s.setCurrentShift);

  const [openingCashText, setOpeningCashText] = useState('0');
  const [opening, setOpening] = useState(false);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // cash movement modal
  const [mvVisible, setMvVisible] = useState(false);
  const [mvType, setMvType] = useState<'IN' | 'OUT'>('IN');
  const [mvAmountText, setMvAmountText] = useState('');
  const [mvReason, setMvReason] = useState('');
  const [mvSaving, setMvSaving] = useState(false);

  useEffect(() => {
    void fetchCurrent();
  }, [fetchCurrent]);

  const loadSummary = useCallback(async () => {
    if (!currentShift) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const s = await getShiftSummary(currentShift.id);
      setSummary(s);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat ringkasan shift.',
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [currentShift]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const doOpen = async () => {
    const amount = parseAmount(openingCashText);
    if (amount === null || amount < 0) {
      Alert.alert('Jumlah tidak valid', 'Masukkan kas awal yang valid.');
      return;
    }
    setOpening(true);
    try {
      const shift = await openShift(amount);
      setCurrentShift(shift);
      Alert.alert('Shift dibuka', 'Selamat bekerja! Shift sudah aktif.');
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal membuka shift.',
      );
    } finally {
      setOpening(false);
    }
  };

  const doCashMovement = async () => {
    const amount = parseAmount(mvAmountText);
    if (amount === null || amount <= 0) {
      Alert.alert('Jumlah tidak valid', 'Masukkan jumlah yang valid.');
      return;
    }
    if (!mvReason.trim()) {
      Alert.alert('Alasan wajib', 'Isi alasan kas masuk/keluar.');
      return;
    }
    setMvSaving(true);
    try {
      const shift = await cashMovement({
        type: mvType,
        amount,
        reason: mvReason.trim(),
      });
      setCurrentShift(shift);
      setMvVisible(false);
      setMvAmountText('');
      setMvReason('');
      await loadSummary();
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal mencatat kas.',
      );
    } finally {
      setMvSaving(false);
    }
  };

  if (shiftLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat shift…</Text>
      </View>
    );
  }

  /* ------------------------------ no open shift ----------------------------- */
  if (!currentShift) {
    if (!hasPermission('shift.open')) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Tidak ada shift aktif</Text>
          <Text style={styles.muted}>
            Anda tidak memiliki izin membuka shift.
          </Text>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.formWrap}>
        <Text style={styles.title}>Buka Shift</Text>
        <Text style={styles.muted}>
          Mulai shift kasir dengan mencatat kas awal di laci.
        </Text>
        <Text style={styles.label}>Kas awal (Rp)</Text>
        <TextInput
          style={styles.input}
          value={openingCashText}
          onChangeText={setOpeningCashText}
          keyboardType="numeric"
          placeholder="0"
        />
        <Pressable
          style={[styles.primaryBtn, opening && styles.btnDisabled]}
          onPress={() => void doOpen()}
          disabled={opening}>
          <Text style={styles.primaryBtnText}>
            {opening ? 'Membuka…' : 'Buka Shift'}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* -------------------------------- open shift ------------------------------ */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shift Aktif</Text>
        <Row label="Kasir" value={currentShift.cashierName ?? '-'} />
        <Row label="Dibuka" value={formatDate(currentShift.openedAt)} />
        <Row
          label="Kas awal"
          value={formatRupiah(currentShift.openingCash)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ringkasan Kas</Text>
        {summaryLoading ? (
          <ActivityIndicator />
        ) : summary ? (
          <>
            <Row
              label="Penjualan tunai"
              value={formatRupiah(summary.cashSales)}
            />
            <Row label="Kas masuk" value={formatRupiah(summary.cashIn)} />
            <Row label="Kas keluar" value={formatRupiah(summary.cashOut)} />
            <View style={styles.divider} />
            <Row
              label="Ekspektasi kas"
              value={formatRupiah(summary.expectedCash)}
              bold
            />
          </>
        ) : (
          <Text style={styles.muted}>Ringkasan belum tersedia.</Text>
        )}
        <Pressable style={styles.ghostBtn} onPress={() => void loadSummary()}>
          <Text style={styles.ghostBtnText}>Muat ulang</Text>
        </Pressable>
      </View>

      <View style={styles.rowBtns}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            setMvType('IN');
            setMvVisible(true);
          }}>
          <Text style={styles.secondaryBtnText}>Kas Masuk</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            setMvType('OUT');
            setMvVisible(true);
          }}>
          <Text style={styles.secondaryBtnText}>Kas Keluar</Text>
        </Pressable>
      </View>

      {hasPermission('shift.close') && (
        <Pressable
          style={styles.dangerBtn}
          onPress={() => navigation.navigate('CloseShift')}>
          <Text style={styles.dangerBtnText}>Tutup Shift</Text>
        </Pressable>
      )}

      <Modal visible={mvVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {mvType === 'IN' ? 'Kas Masuk' : 'Kas Keluar'}
            </Text>
            <Text style={styles.label}>Jumlah (Rp)</Text>
            <TextInput
              style={styles.input}
              value={mvAmountText}
              onChangeText={setMvAmountText}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.label}>Alasan</Text>
            <TextInput
              style={styles.input}
              value={mvReason}
              onChangeText={setMvReason}
              placeholder="cth. Tambahan modal / bayar supplier"
            />
            <View style={styles.rowBtns}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setMvVisible(false)}>
                <Text style={styles.secondaryBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, mvSaving && styles.btnDisabled]}
                onPress={() => void doCashMovement()}
                disabled={mvSaving}>
                <Text style={styles.primaryBtnText}>
                  {mvSaving ? 'Menyimpan…' : 'Simpan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  formWrap: {
    padding: 24,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  muted: {
    color: '#666',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    color: '#666',
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
    flex: 1,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e7d32',
    flex: 1,
  },
  secondaryBtnText: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostBtn: {
    marginTop: 12,
    alignItems: 'center',
    padding: 8,
  },
  ghostBtnText: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#c62828',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});

/**
 * Cashier shift screen — modern minimalist.
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
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
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
import { Badge, Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Nav = NativeStackNavigationProp<AppStackParamList>;

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

export default function ShiftScreen() {
  const navigation = useNavigation<Nav>();
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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Memuat shift…</Text>
      </View>
    );
  }

  /* ------------------------------ no open shift ----------------------------- */
  if (!currentShift) {
    if (!hasPermission('shift.open')) {
      return (
        <View style={styles.center}>
          <EmptyState
            title="Tidak ada shift aktif"
            message="Anda tidak memiliki izin membuka shift."
          />
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Buka Shift"
          subtitle="Mulai shift kasir dengan mencatat kas awal di laci."
        />
        <Card style={styles.card}>
          <Input
            label="Kas awal (Rp)"
            value={openingCashText}
            onChangeText={setOpeningCashText}
            keyboardType="numeric"
            placeholder="0"
            editable={!opening}
          />
          <Button
            title={opening ? 'Membuka…' : 'Buka Shift'}
            onPress={() => void doOpen()}
            loading={opening}
            size="lg"
            style={styles.submit}
          />
        </Card>
      </ScrollView>
    );
  }

  /* -------------------------------- open shift ------------------------------ */
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Shift"
        subtitle={formatDate(currentShift.openedAt)}
        right={<Badge label="Aktif" tone="accent" />}
      />

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Kasir Shift</Text>
        <Row label="Kasir" value={currentShift.cashierName ?? '-'} />
        <Row label="Dibuka" value={formatDate(currentShift.openedAt)} />
        <Row label="Kas awal" value={formatRupiah(currentShift.openingCash)} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Ringkasan Kas</Text>
          <Pressable onPress={() => void loadSummary()}>
            <Text style={styles.reload}>Muat ulang</Text>
          </Pressable>
        </View>
        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : summary ? (
          <>
            <Row label="Penjualan tunai" value={formatRupiah(summary.cashSales)} />
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
      </Card>

      <View style={styles.rowBtns}>
        <View style={styles.rowBtn}>
          <Button
            title="Kas Masuk"
            variant="secondary"
            onPress={() => {
              setMvType('IN');
              setMvVisible(true);
            }}
          />
        </View>
        <View style={styles.rowBtn}>
          <Button
            title="Kas Keluar"
            variant="secondary"
            onPress={() => {
              setMvType('OUT');
              setMvVisible(true);
            }}
          />
        </View>
      </View>

      {hasPermission('shift.close') && (
        <Button
          title="Tutup Shift"
          variant="danger"
          size="lg"
          onPress={() => navigation.navigate('CloseShift')}
          style={styles.closeBtn}
        />
      )}

      <Modal visible={mvVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {mvType === 'IN' ? 'Kas Masuk' : 'Kas Keluar'}
            </Text>
            <Input
              label="Jumlah (Rp)"
              value={mvAmountText}
              onChangeText={setMvAmountText}
              keyboardType="numeric"
              placeholder="0"
              editable={!mvSaving}
            />
            <Input
              label="Alasan"
              value={mvReason}
              onChangeText={setMvReason}
              placeholder="cth. Tambahan modal / bayar supplier"
              editable={!mvSaving}
            />
            <View style={styles.rowBtns}>
              <View style={styles.rowBtn}>
                <Button
                  title="Batal"
                  variant="secondary"
                  onPress={() => setMvVisible(false)}
                />
              </View>
              <View style={styles.rowBtn}>
                <Button
                  title={mvSaving ? 'Menyimpan…' : 'Simpan'}
                  onPress={() => void doCashMovement()}
                  loading={mvSaving}
                />
              </View>
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
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.huge,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reload: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  rowValueBold: {
    ...typography.title,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  rowBtn: {
    flex: 1,
  },
  closeBtn: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  submit: {
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
});

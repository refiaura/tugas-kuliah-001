/**
 * PO detail — modern minimalist.
 * Card sections (info, items, total) with Badge status,
 * action buttons stacked at the bottom.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  formatMoney,
  getPurchaseOrder,
  markOrderedPurchaseOrder,
  poStatusLabel,
  PurchaseOrder,
  submitPurchaseOrder,
} from '../../services/purchaseApi';
import { Badge, Button, Card, EmptyState, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseOrderDetail'>;

function poTone(status: string): 'neutral' | 'accent' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'SUBMITTED':
      return 'warning';
    case 'APPROVED':
      return 'info';
    case 'ORDERED':
    case 'PARTIALLY_RECEIVED':
    case 'RECEIVED':
      return 'accent';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function PurchaseOrderDetailScreen({ navigation, route }: Props) {
  const { poId } = route.params;
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const hasPermission = useAuthStore(s => s.hasPermission);

  const load = useCallback(async () => {
    try {
      setPo(await getPurchaseOrder(poId));
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat detail PO.',
      );
    }
  }, [poId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const runAction = async (
    label: string,
    fn: (id: number) => Promise<PurchaseOrder>,
  ) => {
    Alert.alert(label, `Yakin ingin ${label.toLowerCase()} PO ini?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya',
        onPress: () =>
          void (async () => {
            setActing(true);
            try {
              const updated = await fn(poId);
              setPo(updated);
            } catch (e) {
              Alert.alert(
                'Gagal',
                e instanceof Error ? e.message : `Gagal ${label.toLowerCase()}.`,
              );
            } finally {
              setActing(false);
            }
          })(),
      },
    ]);
  };

  if (loading || !po) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Memuat detail PO…</Text>
      </View>
    );
  }

  const canEdit = hasPermission('purchase.create');
  const canApprove = hasPermission('purchase.approve');
  const canReceive = hasPermission('purchase.receive');
  const canReturn = hasPermission('purchase.return');

  return (
    <View style={styles.container}>
      <ScreenHeader title={po.docNo} subtitle={po.supplierName} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info */}
        <Card>
          <View style={styles.statusRow}>
            <Badge label={poStatusLabel(po.status)} tone={poTone(po.status)} />
          </View>
          <Text style={styles.meta}>
            Dibuat oleh {po.createdBy ?? '-'}
            {po.approvedBy ? ` · Approved oleh ${po.approvedBy}` : ''}
          </Text>
          {po.notes ? <Text style={styles.notes}>{po.notes}</Text> : null}
        </Card>

        {/* Items */}
        <SectionTitle>Baris Produk</SectionTitle>
        {po.lines.length === 0 ? (
          <Card>
            <EmptyState title="Belum ada baris" icon="▤" />
          </Card>
        ) : (
          po.lines.map(l => (
            <Card key={l.id} style={styles.lineCard}>
              <Text style={styles.lineName} numberOfLines={1}>
                {l.productName}
              </Text>
              <Text style={styles.lineDetail}>
                Order {l.qty} × Rp{formatMoney(l.unitPrice)} = Rp
                {formatMoney(l.lineTotal)}
              </Text>
              <Text style={styles.lineProgress}>
                Diterima {l.receivedQty} · Diretur {l.returnedQty}
              </Text>
            </Card>
          ))
        )}

        {/* Total */}
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total PO</Text>
          <Text style={styles.totalValue}>Rp{formatMoney(po.totalAmount)}</Text>
        </Card>

        {/* Actions */}
        <SectionTitle>Aksi</SectionTitle>
        <View style={styles.actions}>
          {po.status === 'DRAFT' && canEdit && (
            <Button
              title="Submit untuk Approval"
              onPress={() => void runAction('Submit PO', submitPurchaseOrder)}
              loading={acting}
              size="lg"
            />
          )}
          {po.status === 'SUBMITTED' && canApprove && (
            <Button
              title="Approve"
              onPress={() => void runAction('Approve PO', approvePurchaseOrder)}
              loading={acting}
              size="lg"
            />
          )}
          {po.status === 'APPROVED' && canEdit && (
            <Button
              title="Kirim ke Supplier"
              onPress={() =>
                void runAction('Kirim PO', markOrderedPurchaseOrder)
              }
              loading={acting}
              size="lg"
            />
          )}
          {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') &&
            canReceive && (
              <Button
                title="Terima Barang"
                onPress={() =>
                  navigation.navigate('GoodsReceipt', { poId: po.id })
                }
                size="lg"
              />
            )}
          {(po.status === 'ORDERED' ||
            po.status === 'PARTIALLY_RECEIVED' ||
            po.status === 'RECEIVED') &&
            canReturn && (
              <Button
                title="Retur ke Supplier"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('PurchaseReturn', { poId: po.id })
                }
                size="lg"
              />
            )}
          {(po.status === 'DRAFT' || po.status === 'SUBMITTED') && canEdit && (
            <Button
              title="Batalkan PO"
              variant="danger"
              onPress={() => void runAction('Batalkan PO', cancelPurchaseOrder)}
              loading={acting}
              size="lg"
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  statusRow: {
    marginBottom: spacing.md,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  lineCard: {
    marginBottom: spacing.md,
  },
  lineName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  lineDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lineProgress: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  totalCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.title,
    color: colors.text,
  },
  actions: {
    gap: spacing.md,
  },
});

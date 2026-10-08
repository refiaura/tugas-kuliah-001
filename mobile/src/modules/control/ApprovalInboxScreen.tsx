/**
 * Approval inbox — modern minimalist.
 * Pending requests (void / return) with approve & reject behind
 * approval.approve / approval.reject. Optional decision note via modal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import {
  approveApproval,
  ApprovalResponse,
  approvalStatusLabel,
  listApprovals,
  rejectApproval,
} from '../../services/controlApi';
import { Badge, Button, Card, EmptyState, Input } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ApprovalInbox'>;

const FILTERS: (string | null)[] = ['PENDING', null];

function filterLabel(f: string | null): string {
  return f === null ? 'Semua' : approvalStatusLabel(f);
}

function statusTone(status: string): 'warning' | 'accent' | 'danger' | 'neutral' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'accent';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function subjectTypeLabel(t: string): string {
  switch (t) {
    case 'VOID':
      return 'Void';
    case 'RETURN':
      return 'Retur';
    default:
      return t;
  }
}

function formatDate(iso: string): string {
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

export default function ApprovalInboxScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canApprove = hasPermission('approval.approve');
  const canReject = hasPermission('approval.reject');

  const [items, setItems] = useState<ApprovalResponse[]>([]);
  const [filter, setFilter] = useState<string | null>('PENDING');
  const [loading, setLoading] = useState(true);

  // decision modal
  const [modalVisible, setModalVisible] = useState(false);
  const [target, setTarget] = useState<ApprovalResponse | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listApprovals(filter ?? undefined, 0, 50);
      setItems(res.items);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat approval.',
      );
    }
  }, [filter]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    return unsub;
  }, [navigation, load]);

  const openDecision = (item: ApprovalResponse, a: 'approve' | 'reject') => {
    setTarget(item);
    setAction(a);
    setNote('');
    setModalVisible(true);
  };

  const doDecide = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (action === 'approve') {
        await approveApproval(target.id, note.trim() || undefined);
        Alert.alert('Disetujui', `Permintaan #${target.id} disetujui.`);
      } else {
        await rejectApproval(target.id, note.trim() || undefined);
        Alert.alert('Ditolak', `Permintaan #${target.id} ditolak.`);
      }
      setModalVisible(false);
      setTarget(null);
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memproses keputusan.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: ApprovalResponse }) => {
    const pending = item.status === 'PENDING';
    return (
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.subjectLabel} numberOfLines={1}>
            {item.subjectLabel}
          </Text>
          <Badge
            label={approvalStatusLabel(item.status)}
            tone={statusTone(item.status)}
          />
        </View>
        <Text style={styles.meta}>
          {subjectTypeLabel(item.subjectType)} · diajukan oleh{' '}
          {item.requestedBy} · {formatDate(item.createdAt)}
        </Text>
        <Text style={styles.reason}>{item.reason}</Text>
        {item.decidedBy ? (
          <Text style={styles.decisionMeta}>
            Diputuskan oleh {item.decidedBy}
            {item.decisionNote ? `: ${item.decisionNote}` : ''}
          </Text>
        ) : null}
        {pending && (canApprove || canReject) && (
          <View style={styles.rowBtns}>
            {canApprove && (
              <Button
                title="Setujui"
                onPress={() => openDecision(item, 'approve')}
                style={styles.flexBtn}
              />
            )}
            {canReject && (
              <Button
                title="Tolak"
                variant="danger"
                onPress={() => openDecision(item, 'reject')}
                style={styles.flexBtn}
              />
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <Pressable
            key={f ?? 'ALL'}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}>
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}>
              {filterLabel(f)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              title="Tidak ada permintaan"
              message="Belum ada permintaan approval."
              icon="✅"
            />
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {action === 'approve' ? 'Setujui' : 'Tolak'} permintaan
            </Text>
            <Text style={styles.modalDesc}>
              {target?.subjectLabel} — diajukan oleh {target?.requestedBy}
            </Text>
            <Input
              label="Catatan keputusan (opsional)"
              value={note}
              onChangeText={setNote}
              placeholder="cth. Disetujui, dana dikembalikan tunai"
              multiline
              editable={!saving}
            />
            <View style={styles.rowBtns}>
              <Button
                title="Batal"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                style={styles.flexBtn}
              />
              <Button
                title={
                  saving
                    ? 'Menyimpan…'
                    : action === 'approve'
                      ? 'Setujui'
                      : 'Tolak'
                }
                variant={action === 'approve' ? 'primary' : 'danger'}
                onPress={() => void doDecide()}
                loading={saving}
                style={styles.flexBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  subjectLabel: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reason: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
  decisionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  flexBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});

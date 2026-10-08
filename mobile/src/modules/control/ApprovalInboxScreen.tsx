/**
 * Approval inbox screen: pending approval requests (void / return), with
 * approve & reject actions behind approval.approve / approval.reject.
 * A decision note is optional and entered via a modal.
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
  TextInput,
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

type Props = NativeStackScreenProps<AppStackParamList, 'ApprovalInbox'>;

const FILTERS: (string | null)[] = ['PENDING', null];

function filterLabel(f: string | null): string {
  return f === null ? 'Semua' : approvalStatusLabel(f);
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.subjectLabel}>{item.subjectLabel}</Text>
          <Text
            style={[
              styles.status,
              pending ? styles.statusPending : styles.statusDecided,
            ]}>
            {approvalStatusLabel(item.status)}
          </Text>
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
              <Pressable
                style={styles.approveBtn}
                onPress={() => openDecision(item, 'approve')}>
                <Text style={styles.approveBtnText}>Setujui</Text>
              </Pressable>
            )}
            {canReject && (
              <Pressable
                style={styles.rejectBtn}
                onPress={() => openDecision(item, 'reject')}>
                <Text style={styles.rejectBtnText}>Tolak</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
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
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Tidak ada permintaan approval.
            </Text>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {action === 'approve' ? 'Setujui' : 'Tolak'} permintaan
            </Text>
            <Text style={styles.muted}>
              {target?.subjectLabel} — diajukan oleh {target?.requestedBy}
            </Text>
            <Text style={styles.label}>Catatan keputusan (opsional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="cth. Disetujui, dana dikembalikan tunai"
              multiline
            />
            <View style={styles.rowBtns}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.secondaryBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[
                  action === 'approve' ? styles.approveBtn : styles.rejectBtn,
                  saving && styles.btnDisabled,
                ]}
                onPress={() => void doDecide()}
                disabled={saving}>
                <Text
                  style={
                    action === 'approve'
                      ? styles.approveBtnText
                      : styles.rejectBtnText
                  }>
                  {saving
                    ? 'Menyimpan…'
                    : action === 'approve'
                      ? 'Setujui'
                      : 'Tolak'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: {
    color: '#666',
    marginBottom: 8,
  },
  filterRow: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterChipActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  filterText: {
    fontSize: 13,
    color: '#555',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 4,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectLabel: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    color: '#ef6c00',
    backgroundColor: '#fff3e0',
  },
  statusDecided: {
    color: '#555',
    backgroundColor: '#f0f0f0',
  },
  meta: {
    fontSize: 12,
    color: '#888',
  },
  reason: {
    fontSize: 14,
    color: '#333',
    marginTop: 6,
  },
  decisionMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  approveBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  rejectBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c62828',
    flex: 1,
  },
  rejectBtnText: {
    color: '#c62828',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1565c0',
    flex: 1,
  },
  secondaryBtnText: {
    color: '#1565c0',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

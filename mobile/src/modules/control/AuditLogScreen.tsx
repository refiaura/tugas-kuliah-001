/**
 * Audit log screen (read-only): list of actor/action/entity changes with
 * an entity-type text filter (e.g. SALE, PRODUCT, USER).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import {
  AuditLogResponse,
  listAuditLogs,
} from '../../services/controlApi';
import { PageInfo } from '../../types/api';

type Props = NativeStackScreenProps<AppStackParamList, 'AuditLog'>;

const PAGE_SIZE = 20;

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

export default function AuditLogScreen({ navigation }: Props) {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [entityType, setEntityType] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await listAuditLogs(
        appliedFilter.trim() || undefined,
        page,
        PAGE_SIZE,
      );
      setLogs(res.items);
      setPagination(res.pagination);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat audit log.',
      );
    }
  }, [appliedFilter, page]);

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

  const applyFilter = () => {
    setPage(0);
    setAppliedFilter(entityType);
  };

  const totalPages = pagination?.totalPages ?? 1;
  const currentPage = pagination?.page ?? page;

  const renderItem = ({ item }: { item: AuditLogResponse }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.action}>{item.action}</Text>
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.meta}>
        {item.actor} · {item.entityType}#{item.entityId}
      </Text>
      {item.newValue ? (
        <Text style={styles.value} numberOfLines={3}>
          {item.newValue}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TextInput
          style={styles.filterInput}
          value={entityType}
          onChangeText={setEntityType}
          placeholder="Filter entityType: SALE, PRODUCT, USER…"
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={applyFilter}
        />
        <Pressable style={styles.filterBtn} onPress={applyFilter}>
          <Text style={styles.filterBtnText}>Cari</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          <FlatList
            data={logs}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.empty}>Tidak ada audit log.</Text>
            }
          />
          <View style={styles.pager}>
            <Pressable
              style={[styles.pageBtn, page === 0 && styles.btnDisabled]}
              onPress={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}>
              <Text style={styles.pageBtnText}>‹ Sebelumnya</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Hal {currentPage + 1} / {Math.max(1, totalPages)}
            </Text>
            <Pressable
              style={[
                styles.pageBtn,
                currentPage >= totalPages - 1 && styles.btnDisabled,
              ]}
              onPress={() => setPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}>
              <Text style={styles.pageBtnText}>Berikutnya ›</Text>
            </Pressable>
          </View>
        </>
      )}
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
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  filterInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterBtn: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  filterBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 8,
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
  action: {
    fontSize: 15,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: '#888',
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 8,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageBtnText: {
    color: '#1565c0',
    fontWeight: '600',
    fontSize: 14,
  },
  pageInfo: {
    fontSize: 13,
    color: '#666',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

/**
 * In-app notifications: daftar, tandai dibaca, unread count.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppNotification,
  formatDateTime,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/reportApi';
import { PageInfo } from '../../types/api';

const TYPE_LABEL: Record<string, string> = {
  LOW_STOCK: 'Stok menipis',
  OUT_OF_STOCK: 'Stok habis',
  PENDING_APPROVAL: 'Approval',
  SHIFT_VARIANCE: 'Selisih kas',
  SHIFT_OPEN: 'Shift',
  PO_PENDING: 'Pembelian',
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    try {
      if (!append) setError(null);
      const r = await getNotifications(p, 20);
      setItems((prev) => (append ? prev : []).concat(r.items));
      setPagination(r.pagination);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat notifikasi');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(0, false);
    }, [load]),
  );

  const onRead = async (n: AppNotification) => {
    if (n.read) return;
    try {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Gagal menandai notifikasi');
    }
  };

  const onReadAll = () => {
    Alert.alert('Tandai semua dibaca?', 'Semua notifikasi akan ditandai sudah dibaca.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya',
        onPress: () => {
          markAllNotificationsRead()
            .then(() => setItems((prev) => prev.map((x) => ({ ...x, read: true }))))
            .catch((e: unknown) =>
              Alert.alert('Gagal', e instanceof Error ? e.message : 'Gagal'),
            );
        },
      },
    ]);
  };

  const loadMore = () => {
    if (loadingMore || !pagination) return;
    if (page + 1 >= pagination.totalPages) return;
    setLoadingMore(true);
    void load(page + 1, true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        <Pressable onPress={onReadAll} hitSlop={8}>
          <Text style={styles.readAll}>Tandai semua dibaca</Text>
        </Pressable>
      </View>
      {error && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(0, false);
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Belum ada notifikasi.</Text>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 12 }} /> : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, !item.read && styles.unread]}
              onPress={() => void onRead(item)}>
              <View style={styles.rowBetween}>
                <Text style={styles.type}>{TYPE_LABEL[item.type] ?? item.type}</Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#c62828', textAlign: 'center' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  readAll: { color: '#1565c0', fontSize: 14, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },
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
  unread: { borderLeftWidth: 4, borderLeftColor: '#1565c0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontSize: 12, color: '#1565c0', fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1565c0' },
  title: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  message: { fontSize: 14, color: '#444', marginTop: 2 },
  time: { fontSize: 12, color: '#999', marginTop: 6 },
});

/**
 * In-app notifications — modern minimalist.
 * Daftar, tandai dibaca, unread count.
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
import { Card, EmptyState, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

const TYPE_LABEL: Record<string, string> = {
  LOW_STOCK: 'Stok menipis',
  OUT_OF_STOCK: 'Stok habis',
  PENDING_APPROVAL: 'Approval',
  SHIFT_VARIANCE: 'Selisih kas',
  SHIFT_OPEN: 'Shift',
  PO_PENDING: 'Pembelian',
};

const TYPE_TONE: Record<string, 'warning' | 'danger' | 'info' | 'accent' | 'neutral'> = {
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'danger',
  PENDING_APPROVAL: 'info',
  SHIFT_VARIANCE: 'warning',
  SHIFT_OPEN: 'info',
  PO_PENDING: 'accent',
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const unreadCount = items.filter(i => !i.read).length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifikasi"
        subtitle={unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
        right={
          <Pressable onPress={onReadAll} hitSlop={8}>
            <Text style={styles.readAll}>Tandai dibaca</Text>
          </Pressable>
        }
      />
      {error && items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState title="Gagal memuat" message={error} icon="⚠" />
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
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Belum ada notifikasi"
              message="Notifikasi stok, approval, dan shift akan muncul di sini."
              icon="🔔"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.loadMore} color={colors.primary} />
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
              onPress={() => void onRead(item)}>
              <Card style={!item.read ? styles.unreadCard : undefined}>
                <View style={styles.rowBetween}>
                  <Text style={styles.type}>
                    {TYPE_LABEL[item.type] ?? item.type}
                  </Text>
                  {!item.read && <View style={styles.dot} />}
                </View>
                <Text style={[styles.title, !item.read && styles.titleUnread]}>
                  {item.title}
                </Text>
                <Text style={styles.message} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
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
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  readAll: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    flexGrow: 1,
    gap: spacing.md,
  },
  pressable: {
    // wrapper so Card keeps its own padding
  },
  pressed: {
    opacity: 0.85,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  type: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  titleUnread: {
    fontWeight: '700',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  loadMore: {
    margin: spacing.md,
  },
});

/**
 * Audit log — modern minimalist.
 * Read-only list of actor/action/entity changes with an entity-type filter.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import {
  AuditLogResponse,
  listAuditLogs,
} from '../../services/controlApi';
import { PageInfo } from '../../types/api';
import { Badge, Card, EmptyState, Input } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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
    <Card>
      <View style={styles.cardHeader}>
        <Text style={styles.action} numberOfLines={1}>
          {item.action}
        </Text>
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {item.actor}
        </Text>
        <Badge label={item.entityType} tone="info" />
      </View>
      <Text style={styles.entityId}>#{item.entityId}</Text>
      {item.newValue ? (
        <Text style={styles.value} numberOfLines={3}>
          {item.newValue}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <Input
          value={entityType}
          onChangeText={setEntityType}
          placeholder="Filter: SALE, PRODUCT, USER…"
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={applyFilter}
          containerStyle={styles.filterInput}
        />
        <Pressable
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          onPress={applyFilter}>
          <Text style={styles.filterBtnText}>Cari</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <FlatList
            data={logs}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            ListEmptyComponent={
              <EmptyState
                title="Tidak ada audit log"
                message="Belum ada aktivitas tercatat."
                icon="📋"
              />
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
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterInput: {
    flex: 1,
    marginBottom: 0,
  },
  filterBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  filterBtnText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  action: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  entityId: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    backgroundColor: colors.slate[100],
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  pageInfo: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

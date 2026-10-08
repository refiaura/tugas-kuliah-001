/**
 * Product list — modern minimalist.
 * Prominent search, compact cards with clear pricing, status badges.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import {
  listProducts,
  ProductResponse,
  productImageUrl,
} from '../../services/productApi';
import { AppStackParamList } from '../../app/navigation';
import { Badge, Button, Card, EmptyState, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductList'>;

function formatRupiah(value: number): string {
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

export default function ProductListScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission('product.create');

  const [items, setItems] = useState<ProductResponse[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      setError(null);
      const result = await listProducts({
        search: query.trim() || undefined,
        activeOnly: false,
        size: 50,
      });
      setItems(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat produk.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load('');
      setLoading(false);
    })();
  }, [load]);

  // Debounced search: reload 400ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!loading) {
          await load(search);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [search, load, loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(search);
    setRefreshing(false);
  }, [load, search]);

  // Refresh the list when returning from the form screen.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load(search);
    });
    return unsub;
  }, [navigation, load, search]);

  const renderItem = ({ item }: { item: ProductResponse }) => {
    const thumb = productImageUrl(item.imageUrl);
    return (
      <Pressable
        onPress={() =>
          navigation.navigate('ProductForm', { productId: item.id })
        }>
        <Card style={styles.card}>
          <View style={styles.cardRow}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbIcon}>○</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sku}>SKU · {item.sku}</Text>
              <Text style={styles.price}>{formatRupiah(item.sellingPrice)}</Text>
            </View>
            <Badge
              label={item.active ? 'Aktif' : 'Nonaktif'}
              tone={item.active ? 'accent' : 'neutral'}
            />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Produk"
        subtitle={`${items.length} produk terdaftar`}
        right={
          canCreate ? (
            <Button
              title="+ Tambah"
              onPress={() => navigation.navigate('ProductForm', {})}
              testID="product-add"
            />
          ) : undefined
        }
      />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / SKU / barcode…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="product-search"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState title="Gagal memuat" message={error} icon="⚠" />
          <Button
            title="Coba lagi"
            variant="secondary"
            onPress={() => {
              setLoading(true);
              void load(search).finally(() => setLoading(false));
            }}
            style={styles.retry}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Tidak ada produk"
              message={
                search
                  ? 'Coba kata kunci lain.'
                  : 'Tambah produk pertama Anda.'
              }
              icon="○"
            />
          }
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
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 52,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.slate[100],
    marginRight: spacing.md,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbIcon: {
    fontSize: 20,
    color: colors.textMuted,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  sku: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  price: {
    ...typography.title,
    color: colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  retry: {
    marginTop: spacing.lg,
  },
});

/**
 * Product list: search (name/SKU/barcode), pull-to-refresh, active badge.
 * Add button is only shown with the product.create permission.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
} from '../../services/productApi';
import { AppStackParamList } from '../../app/navigation';

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

  const renderItem = ({ item }: { item: ProductResponse }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate('ProductForm', { productId: item.id })
      }>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View
          style={[
            styles.badge,
            item.active ? styles.badgeActive : styles.badgeInactive,
          ]}>
          <Text
            style={[
              styles.badgeText,
              item.active ? styles.badgeTextActive : styles.badgeTextInactive,
            ]}>
            {item.active ? 'Aktif' : 'Nonaktif'}
          </Text>
        </View>
      </View>
      <Text style={styles.sku}>SKU: {item.sku}</Text>
      <Text style={styles.price}>{formatRupiah(item.sellingPrice)}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / SKU / barcode…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="product-search"
        />
        {canCreate ? (
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('ProductForm', {})}
            testID="product-add">
            <Text style={styles.addButtonText}>+ Tambah</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              void load(search).finally(() => setLoading(false));
            }}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Tidak ada produk ditemukan.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  sku: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1565c0',
    marginTop: 6,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: '#e8f5e9',
  },
  badgeInactive: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: '#2e7d32',
  },
  badgeTextInactive: {
    color: '#999',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
  },
});

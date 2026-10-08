/**
 * Purchase hub screen: permission-gated shortcuts to PO list/form,
 * goods receipt, and purchase return.
 */
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Purchase'>;

type RouteName =
  | 'PurchaseOrderList'
  | 'PurchaseOrderForm'
  | 'GoodsReceipt'
  | 'PurchaseReturn';

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  permission: string;
  route: RouteName;
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'po-list',
    title: 'Daftar Purchase Order',
    subtitle: 'Filter status & detail PO',
    permission: 'purchase.view',
    route: 'PurchaseOrderList',
  },
  {
    key: 'po-form',
    title: 'Buat Purchase Order',
    subtitle: 'PO baru (Draft)',
    permission: 'purchase.create',
    route: 'PurchaseOrderForm',
  },
  {
    key: 'receipt',
    title: 'Terima Barang',
    subtitle: 'Goods receipt (parsial didukung)',
    permission: 'purchase.receive',
    route: 'GoodsReceipt',
  },
  {
    key: 'return',
    title: 'Retur ke Supplier',
    subtitle: 'Stock out + kredit supplier',
    permission: 'purchase.return',
    route: 'PurchaseReturn',
  },
];

export default function PurchaseScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  const go = (route: RouteName) => {
    switch (route) {
      case 'PurchaseOrderList':
        navigation.navigate('PurchaseOrderList');
        break;
      case 'PurchaseOrderForm':
        navigation.navigate('PurchaseOrderForm');
        break;
      case 'GoodsReceipt':
        navigation.navigate('GoodsReceipt', {});
        break;
      case 'PurchaseReturn':
        navigation.navigate('PurchaseReturn', {});
        break;
    }
  };

  return (
    <View style={styles.container}>
      {visible.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Anda tidak memiliki izin modul pembelian.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.menuList}
          renderItem={({ item }) => (
            <Pressable
              style={styles.menuItem}
              onPress={() => go(item.route)}>
              <View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
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
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
  menuList: {
    padding: 16,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 22,
    color: '#aaa',
  },
});

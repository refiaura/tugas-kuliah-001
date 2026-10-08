/**
 * Purchase hub — modern minimalist.
 * Permission-gated menu cards, single accent, generous whitespace.
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
import { Card, EmptyState, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

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
      <ScreenHeader title="Pembelian" subtitle="Kelola PO, penerimaan, dan retur" />

      {visible.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="Tidak ada izin"
            message="Anda tidak memiliki izin modul pembelian."
          />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.menuList}
          renderItem={({ item }) => (
            <Pressable onPress={() => go(item.route)}>
              <Card style={styles.menuItem} padding={spacing.xl}>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
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
  },
  menuList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  menuChevron: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.md,
  },
});

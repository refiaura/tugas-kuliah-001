/**
 * Root navigation.
 *
 * - While the auth session is bootstrapping: simple splash/loading screen.
 * - Not logged in: AuthStack (Login).
 * - Logged in: AppStack (Home + module placeholders). The home menu is
 *   filtered by the user's permissions; every module screen is a placeholder
 *   until its milestone lands.
 */
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import LoginScreen from '../modules/auth/LoginScreen';
import ProductListScreen from '../modules/products/ProductListScreen';
import ProductFormScreen from '../modules/products/ProductFormScreen';
import PosScreen from '../modules/pos/PosScreen';
import PaymentScreen from '../modules/pos/PaymentScreen';
import ReceiptScreen from '../modules/pos/ReceiptScreen';
import ShiftScreen from '../modules/shift/ShiftScreen';
import CloseShiftScreen from '../modules/shift/CloseShiftScreen';
import StockScreen from '../modules/stock/StockScreen';
import StockOpnameScreen from '../modules/stock/StockOpnameScreen';
import StockAdjustmentScreen from '../modules/stock/StockAdjustmentScreen';
import StockTransferScreen from '../modules/stock/StockTransferScreen';
import StockHistoryScreen from '../modules/stock/StockHistoryScreen';
import PurchaseScreen from '../modules/purchase/PurchaseScreen';
import PurchaseOrderListScreen from '../modules/purchase/PurchaseOrderListScreen';
import PurchaseOrderFormScreen from '../modules/purchase/PurchaseOrderFormScreen';
import PurchaseOrderDetailScreen from '../modules/purchase/PurchaseOrderDetailScreen';
import GoodsReceiptScreen from '../modules/purchase/GoodsReceiptScreen';
import PurchaseReturnScreen from '../modules/purchase/PurchaseReturnScreen';
import ControlScreen from '../modules/control/ControlScreen';
import TransactionHistoryScreen from '../modules/control/TransactionHistoryScreen';
import TransactionDetailScreen from '../modules/control/TransactionDetailScreen';
import ReturnRequestScreen from '../modules/control/ReturnRequestScreen';
import ApprovalInboxScreen from '../modules/control/ApprovalInboxScreen';
import AuditLogScreen from '../modules/control/AuditLogScreen';
import { SaleResponse } from '../services/saleApi';

/* ---------------------------------- types --------------------------------- */

type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  ProductList: undefined;
  ProductForm: { productId?: number };
  Pos: undefined;
  Payment: { resumeSaleId?: number };
  Receipt: { sale: SaleResponse };
  Shift: undefined;
  CloseShift: undefined;
  Stock: undefined;
  StockOpname: undefined;
  StockAdjustment: undefined;
  StockTransfer: undefined;
  StockHistory: undefined;
  Purchase: undefined;
  PurchaseOrderList: undefined;
  PurchaseOrderForm: undefined;
  PurchaseOrderDetail: { poId: number };
  GoodsReceipt: { poId?: number };
  PurchaseReturn: { poId?: number };
  Control: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { saleId: number };
  ReturnRequest: { saleId: number };
  ApprovalInbox: undefined;
  AuditLog: undefined;
  ModulePlaceholder: { title: string };
};

type PlaceholderProps = NativeStackScreenProps<
  AppStackParamList,
  'ModulePlaceholder'
>;

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

/* ------------------------------ menu definition -------------------------- */

interface MenuItem {
  key: string;
  title: string;
  permission: string;
  /** Stack route to navigate to (defaults to ModulePlaceholder). */
  route?:
    | 'ProductList'
    | 'Pos'
    | 'Shift'
    | 'Stock'
    | 'Purchase'
    | 'Control';
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'pos', title: 'Kasir / POS', permission: 'sales.create', route: 'Pos' },
  {
    key: 'shift',
    title: 'Shift Kasir',
    permission: 'shift.open',
    route: 'Shift',
  },
  {
    key: 'stock',
    title: 'Inventaris',
    permission: 'stock.view',
    route: 'Stock',
  },
  {
    key: 'purchase',
    title: 'Pembelian',
    permission: 'purchase.view',
    route: 'Purchase',
  },
  {
    key: 'control',
    title: 'Kontrol',
    permission: 'sales.view',
    route: 'Control',
  },
  {
    key: 'products',
    title: 'Produk',
    permission: 'product.view',
    route: 'ProductList',
  },
  { key: 'users', title: 'Pengguna', permission: 'user.view' },
  { key: 'reports', title: 'Laporan', permission: 'report.sales' },
];

/* --------------------------------- screens -------------------------------- */

function SplashScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
      <Text style={styles.splashText}>Memuat…</Text>
    </View>
  );
}

function LogoutButton() {
  const logout = useAuthStore(s => s.logout);
  const onPress = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };
  return (
    <Pressable onPress={onPress} style={styles.logoutButton} hitSlop={8}>
      <Text style={styles.logoutText}>Keluar</Text>
    </Pressable>
  );
}

function HomeScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Home'>) {
  const user = useAuthStore(s => s.user);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visibleMenu = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.fullName ?? '-'}</Text>
        <Text style={styles.profileMeta}>
          @{user?.username} · {(user?.roles ?? []).join(', ')}
        </Text>
      </View>

      {visibleMenu.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Tidak ada menu yang tersedia untuk akun ini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleMenu}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.menuList}
          renderItem={({ item }) => (
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (item.route) {
                  navigation.navigate(item.route);
                } else {
                  navigation.navigate('ModulePlaceholder', {
                    title: item.title,
                  });
                }
              }}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ModulePlaceholderScreen({ route }: PlaceholderProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.placeholderTitle}>{route.params.title}</Text>
      <Text style={styles.placeholderText}>
        Modul {route.params.title} — segera hadir di milestone berikutnya.
      </Text>
    </View>
  );
}

/* --------------------------------- stacks --------------------------------- */

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Kasir POS',
          headerRight: () => <LogoutButton />,
        }}
      />
      <AppStack.Screen
        name="ProductList"
        component={ProductListScreen}
        options={{ title: 'Produk' }}
      />
      <AppStack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={({ route }) => ({
          title: route.params.productId !== undefined ? 'Ubah Produk' : 'Tambah Produk',
        })}
      />
      <AppStack.Screen
        name="Pos"
        component={PosScreen}
        options={{ title: 'Kasir' }}
      />
      <AppStack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: 'Pembayaran' }}
      />
      <AppStack.Screen
        name="Receipt"
        component={ReceiptScreen}
        options={{ title: 'Struk', headerBackVisible: false }}
      />
      <AppStack.Screen
        name="Shift"
        component={ShiftScreen}
        options={{ title: 'Shift Kasir' }}
      />
      <AppStack.Screen
        name="CloseShift"
        component={CloseShiftScreen}
        options={{ title: 'Tutup Shift' }}
      />
      <AppStack.Screen
        name="Stock"
        component={StockScreen}
        options={{ title: 'Inventaris' }}
      />
      <AppStack.Screen
        name="StockOpname"
        component={StockOpnameScreen}
        options={{ title: 'Stock Opname' }}
      />
      <AppStack.Screen
        name="StockAdjustment"
        component={StockAdjustmentScreen}
        options={{ title: 'Stock Adjustment' }}
      />
      <AppStack.Screen
        name="StockTransfer"
        component={StockTransferScreen}
        options={{ title: 'Stock Transfer' }}
      />
      <AppStack.Screen
        name="StockHistory"
        component={StockHistoryScreen}
        options={{ title: 'Riwayat Pergerakan Stok' }}
      />
      <AppStack.Screen
        name="Purchase"
        component={PurchaseScreen}
        options={{ title: 'Pembelian' }}
      />
      <AppStack.Screen
        name="PurchaseOrderList"
        component={PurchaseOrderListScreen}
        options={{ title: 'Purchase Order' }}
      />
      <AppStack.Screen
        name="PurchaseOrderForm"
        component={PurchaseOrderFormScreen}
        options={{ title: 'Buat Purchase Order' }}
      />
      <AppStack.Screen
        name="PurchaseOrderDetail"
        component={PurchaseOrderDetailScreen}
        options={{ title: 'Detail PO' }}
      />
      <AppStack.Screen
        name="GoodsReceipt"
        component={GoodsReceiptScreen}
        options={{ title: 'Terima Barang' }}
      />
      <AppStack.Screen
        name="PurchaseReturn"
        component={PurchaseReturnScreen}
        options={{ title: 'Retur Pembelian' }}
      />
      <AppStack.Screen
        name="Control"
        component={ControlScreen}
        options={{ title: 'Kontrol' }}
      />
      <AppStack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: 'Riwayat Transaksi' }}
      />
      <AppStack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: 'Detail Transaksi' }}
      />
      <AppStack.Screen
        name="ReturnRequest"
        component={ReturnRequestScreen}
        options={{ title: 'Retur Penjualan' }}
      />
      <AppStack.Screen
        name="ApprovalInbox"
        component={ApprovalInboxScreen}
        options={{ title: 'Approval Inbox' }}
      />
      <AppStack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ title: 'Audit Log' }}
      />
      <AppStack.Screen
        name="ModulePlaceholder"
        component={ModulePlaceholderScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </AppStack.Navigator>
  );
}

/* ---------------------------------- root ---------------------------------- */

export function RootNavigator() {
  const isLoading = useAuthStore(s => s.isLoading);
  const user = useAuthStore(s => s.user);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

/* --------------------------------- styles --------------------------------- */

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
  splashText: {
    marginTop: 12,
    color: '#666',
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  menuList: {
    padding: 16,
    paddingTop: 8,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '600',
  },
  menuChevron: {
    fontSize: 20,
    color: '#999',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#666',
    textAlign: 'center',
  },
  logoutButton: {
    marginRight: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutText: {
    color: '#c62828',
    fontSize: 16,
    fontWeight: '600',
  },
});

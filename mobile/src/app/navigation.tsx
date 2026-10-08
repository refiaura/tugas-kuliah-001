/**
 * Root navigation — modern minimalist with bottom tabs.
 *
 * - While the auth session is bootstrapping: splash/loading.
 * - Not logged in: AuthStack (Login).
 * - Logged in: AppStack → MainTabs (bottom tabs) + detail screens.
 *   Tabs are permission-filtered; "Menu" tab holds everything else.
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
import { NavigationContainer, useNavigation, NavigatorScreenParams } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  BarChart3,
  Clock,
  LayoutGrid,
  Package,
  ShoppingCart,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { colors, radius, spacing, typography } from '../theme';
import { Card, EmptyState, ScreenHeader } from '../components';
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
import DashboardScreen from '../modules/reports/DashboardScreen';
import ReportsScreen, { ReportKind } from '../modules/reports/ReportsScreen';
import ReportViewerScreen from '../modules/reports/ReportViewerScreen';
import NotificationsScreen from '../modules/reports/NotificationsScreen';
import { SaleResponse } from '../services/saleApi';

/* ---------------------------------- types --------------------------------- */

type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  ProductForm: { productId?: number };
  Payment: { resumeSaleId?: number };
  Receipt: { sale: SaleResponse };
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
  Reports: undefined;
  ReportViewer: { kind: ReportKind; title: string };
  Notifications: undefined;
  ModulePlaceholder: { title: string };
};

export type TabParamList = {
  PosTab: undefined;
  ProductTab: undefined;
  ShiftTab: undefined;
  DashboardTab: undefined;
  MenuTab: undefined;
};

type PlaceholderProps = NativeStackScreenProps<
  AppStackParamList,
  'ModulePlaceholder'
>;

/* --------------------------------- menu ----------------------------------- */

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  permission: string;
  icon: React.ReactNode;
  route:
    | 'Stock'
    | 'Purchase'
    | 'Control'
    | 'Reports'
    | 'Notifications';
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'stock',
    title: 'Inventaris',
    subtitle: 'Stok, opname, transfer',
    permission: 'stock.view',
    icon: <Package size={22} color={colors.primary} />,
    route: 'Stock',
  },
  {
    key: 'purchase',
    title: 'Pembelian',
    subtitle: 'PO, terima barang, retur',
    permission: 'purchase.view',
    icon: <ShoppingCart size={22} color={colors.primary} />,
    route: 'Purchase',
  },
  {
    key: 'control',
    title: 'Kontrol',
    subtitle: 'Transaksi, approval, audit',
    permission: 'sales.view',
    icon: <LayoutGrid size={22} color={colors.primary} />,
    route: 'Control',
  },
  {
    key: 'reports',
    title: 'Laporan',
    subtitle: 'Penjualan, stok, kas',
    permission: 'report.sales',
    icon: <BarChart3 size={22} color={colors.primary} />,
    route: 'Reports',
  },
  {
    key: 'notifications',
    title: 'Notifikasi',
    subtitle: 'Alert & pengumuman',
    permission: 'notification.view',
    icon: <Clock size={22} color={colors.primary} />,
    route: 'Notifications',
  },
];

/* --------------------------------- screens -------------------------------- */

function SplashScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.splashText}>Memuat…</Text>
    </View>
  );
}

function MenuScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visibleMenu = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  const onLogout = () => {
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

  const goTo = (route: MenuItem['route']) => {
    navigation.navigate(route);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Menu" subtitle={`@${user?.username ?? '-'}`} />
      <Card style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.fullName ?? '-'}</Text>
        <Text style={styles.profileMeta}>
          {(user?.roles ?? []).join(', ')}
        </Text>
      </Card>

      {visibleMenu.length === 0 ? (
        <EmptyState
          title="Tidak ada menu"
          message="Tidak ada menu yang tersedia untuk akun ini."
          icon="🔒"
        />
      ) : (
        <FlatList
          data={visibleMenu}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.menuList}
          renderItem={({ item }) => (
            <Pressable onPress={() => goTo(item.route)}>
              <Card style={styles.menuItem}>
                <View style={styles.menuIcon}>{item.icon}</View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={onLogout} style={styles.logoutRow}>
        <LogOut size={20} color={colors.danger[600]} />
        <Text style={styles.logoutText}>Keluar</Text>
      </Pressable>
    </View>
  );
}

function ModulePlaceholderScreen({ route }: PlaceholderProps) {
  return (
    <View style={styles.center}>
      <EmptyState
        title={route.params.title}
        message={`Modul ${route.params.title} — segera hadir.`}
      />
    </View>
  );
}

/* --------------------------------- tabs ----------------------------------- */

const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const hasPermission = useAuthStore(s => s.hasPermission);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
          height: 64,
        },
        tabBarLabelStyle: {
          ...typography.tiny,
        },
      }}>
      {hasPermission('sales.create') && (
        <Tab.Screen
          name="PosTab"
          component={PosScreen}
          options={{
            title: 'Kasir',
            tabBarIcon: ({ color, size }) => (
              <ShoppingCart size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('product.view') && (
        <Tab.Screen
          name="ProductTab"
          component={ProductListScreen}
          options={{
            title: 'Produk',
            tabBarIcon: ({ color, size }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('shift.open') && (
        <Tab.Screen
          name="ShiftTab"
          component={ShiftScreen}
          options={{
            title: 'Shift',
            tabBarIcon: ({ color, size }) => (
              <Clock size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('report.sales') && (
        <Tab.Screen
          name="DashboardTab"
          component={DashboardScreen}
          options={{
            title: 'Laporan',
            tabBarIcon: ({ color, size }) => (
              <BarChart3 size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="MenuTab"
        component={MenuScreen}
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/* --------------------------------- stacks --------------------------------- */

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

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
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      {/* Detail screens pushed above tabs */}
      <AppStack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={({ route }) => ({
          title: route.params.productId !== undefined ? 'Ubah Produk' : 'Tambah Produk',
        })}
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
        options={{ title: 'Penyesuaian Stok' }}
      />
      <AppStack.Screen
        name="StockTransfer"
        component={StockTransferScreen}
        options={{ title: 'Transfer Stok' }}
      />
      <AppStack.Screen
        name="StockHistory"
        component={StockHistoryScreen}
        options={{ title: 'Riwayat Stok' }}
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
        options={{ title: 'Buat PO' }}
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
        options={{ title: 'Approval' }}
      />
      <AppStack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ title: 'Audit Log' }}
      />
      <AppStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Laporan' }}
      />
      <AppStack.Screen
        name="ReportViewer"
        component={ReportViewerScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <AppStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifikasi' }}
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
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  splashText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  profileCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  profileName: {
    ...typography.title,
    color: colors.text,
  },
  profileMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  menuList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
    color: colors.textMuted,
    marginTop: 2,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: {
    ...typography.bodyBold,
    color: colors.danger[600],
  },
});

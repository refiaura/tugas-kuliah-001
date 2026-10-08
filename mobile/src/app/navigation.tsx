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

/* ---------------------------------- types --------------------------------- */

type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  ProductList: undefined;
  ProductForm: { productId?: number };
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
  route?: 'ProductList';
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'pos', title: 'Kasir / POS', permission: 'sales.create' },
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

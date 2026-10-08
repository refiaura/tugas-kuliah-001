/**
 * Control hub screen (Milestone 7): permission-gated shortcuts to
 * transaction history, sale returns, the approval inbox, and the audit log.
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

type Props = NativeStackScreenProps<AppStackParamList, 'Control'>;

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  permission: string;
  route: 'TransactionHistory' | 'ApprovalInbox' | 'AuditLog';
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'history',
    title: 'Riwayat Transaksi',
    subtitle: 'Lihat transaksi & ajukan void/retur',
    permission: 'sales.view',
    route: 'TransactionHistory',
  },
  {
    key: 'returns',
    title: 'Retur Penjualan',
    subtitle: 'Ajukan retur dari transaksi selesai',
    permission: 'sales.view',
    route: 'TransactionHistory',
  },
  {
    key: 'approvals',
    title: 'Approval Inbox',
    subtitle: 'Setujui / tolak permintaan void & retur',
    permission: 'approval.view',
    route: 'ApprovalInbox',
  },
  {
    key: 'audit',
    title: 'Audit Log',
    subtitle: 'Jejak perubahan data (read-only)',
    permission: 'approval.view',
    route: 'AuditLog',
  },
];

export default function ControlScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  return (
    <View style={styles.container}>
      {visible.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Anda tidak memiliki izin modul kontrol.
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
              onPress={() => navigation.navigate(item.route)}>
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
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
    color: '#999',
  },
});

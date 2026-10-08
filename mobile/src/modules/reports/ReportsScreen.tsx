/**
 * Menu daftar laporan. Setiap item membuka ReportViewer dengan tipe berbeda.
 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';

export type ReportKind =
  | 'sales'
  | 'products'
  | 'inventory'
  | 'cash'
  | 'purchases'
  | 'profit';

interface ReportItem {
  kind: ReportKind;
  title: string;
  desc: string;
  permission: string;
}

const REPORTS: ReportItem[] = [
  { kind: 'sales', title: 'Laporan Penjualan', desc: 'Transaksi per invoice', permission: 'report.sales' },
  { kind: 'products', title: 'Laporan Produk Terjual', desc: 'Qty & omzet per produk', permission: 'report.sales' },
  { kind: 'inventory', title: 'Laporan Stok', desc: 'Mutasi & saldo per produk', permission: 'report.stock' },
  { kind: 'cash', title: 'Laporan Kas', desc: 'Rekap kas per shift', permission: 'report.cash' },
  { kind: 'purchases', title: 'Laporan Pembelian', desc: 'PO per supplier', permission: 'report.purchase' },
  { kind: 'profit', title: 'Laporan Laba', desc: 'Penjualan bersih - HPP', permission: 'report.profit' },
];

type Props = NativeStackScreenProps<AppStackParamList, 'Reports'>;

export default function ReportsScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = REPORTS.filter(r => hasPermission(r.permission));

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={item => item.kind}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Tidak ada laporan yang tersedia untuk akun ini.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => navigation.navigate('ReportViewer', { kind: item.kind, title: item.title })}>
            <View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  item: {
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
  title: { fontSize: 16, fontWeight: '600' },
  desc: { fontSize: 13, color: '#666', marginTop: 2 },
  chevron: { fontSize: 22, color: '#999' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});

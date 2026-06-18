import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * F0 — Welcome screen. Stub do Move (app do motorista) sem domínio.
 *
 * Em F1B+ isto será substituído por uma stack de navegação real com
 * login, listagem de entregas, scanner de documentos, etc.
 */
export default function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scorpius Move</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>F0 — Infraestrutura</Text>
      </View>
      <Text style={styles.muted}>
        App do motorista. Nenhuma feature de negócio habilitada.
      </Text>
      <Text style={styles.muted}>Aguarde a fase F1A.</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 24,
  },
  badgeText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  muted: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 2,
  },
});

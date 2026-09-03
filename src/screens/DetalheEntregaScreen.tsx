import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { getDelivery, type DeliveryDetail } from '@/api/deliveries';
import { findDelivery } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'DetalheEntrega'>;
type Route_ = RouteProp<AppStackParamList, 'DetalheEntrega'>;

export function DetalheEntregaScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);

  useEffect(() => {
    void getDelivery(route.params.deliveryId)
      .then(setDelivery)
      .catch(() => {
        const mock = findDelivery(route.params.deliveryId);
        if (!mock) return;
        setDelivery({
          id: mock.id,
          reference_code: mock.code,
          status: mock.status,
          delivery_address: mock.address,
          recipient: { name: mock.customer.name, phone: mock.customer.phone },
          documents: mock.items.map((item, idx) => ({
            id: mock.id * 10 + idx,
            reference_number: item.sku,
            delivery_status: 'pending',
            type: { name: item.description, slug: 'item' },
          })),
          documents_summary: { total: mock.items.length, delivered: 0, failed: 0, pending: mock.items.length },
        });
      });
  }, [route.params.deliveryId]);

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Carregando...</Text>
      </View>
    );
  }

  const addr = delivery.delivery_address as {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <View style={{ gap: tokens.space[2] }}>
          <Text style={{ fontSize: tokens.text['3xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.detail.title.replace('{code}', delivery.reference_code)}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {delivery.documents_summary.delivered}/{delivery.documents_summary.total} documentos entregues
          </Text>
        </View>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.customerSection}
          </Text>
          <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {delivery.recipient?.name ?? '—'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{delivery.recipient?.phone}</Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.addressSection}
          </Text>
          <Text style={{ fontSize: tokens.text.base, color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {addr.street}{addr.number ? `, ${addr.number}` : ''}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{addr.neighborhood}</Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            Documentos ({delivery.documents.length})
          </Text>
          <View style={{ marginTop: tokens.space[2], gap: tokens.space[2] }}>
            {delivery.documents.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() =>
                  doc.delivery_status === 'pending' &&
                  navigation.navigate('Comprovante', { deliveryId: delivery.id, documentId: doc.id })
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: tokens.space[2],
                    borderBottomColor: colors.borderDefault,
                    borderBottomWidth: 1,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm, fontWeight: tokens.weight.medium }}>
                      {doc.reference_number ?? doc.type?.name ?? `#${doc.id}`}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>{doc.type?.name}</Text>
                  </View>
                  <StatusBadge
                    status={doc.delivery_status === 'delivered' ? 'delivered' : doc.delivery_status === 'failed' ? 'failed' : 'pending'}
                    label={doc.delivery_status}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </Card>

        <View style={{ gap: tokens.space[3] }}>
          <Button label={ptBR.detail.openMap} onPress={() => navigation.navigate('MapaRota', { deliveryId: delivery.id })} fullWidth />
          <Button
            label="Reportar ocorrência"
            variant="secondary"
            onPress={() => navigation.navigate('Ocorrencia', { deliveryId: delivery.id })}
            fullWidth
          />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

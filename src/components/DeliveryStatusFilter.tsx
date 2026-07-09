import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import {
  countDeliveriesByUiStatus,
  createAllUiStatusSet,
  DELIVERY_UI_STATUSES,
  isAllUiStatusesSelected,
} from '@/lib/mapDelivery';
import type { DeliveryUiStatus, DeliveryViewModel } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';

const STATUS_LABELS: Record<DeliveryUiStatus, string> = {
  pending: ptBR.home.filter.pending,
  in_route: ptBR.home.filter.inRoute,
  delivered: ptBR.home.filter.delivered,
  failed: ptBR.home.filter.failed,
};

interface DeliveryStatusFilterProps {
  value: ReadonlySet<DeliveryUiStatus>;
  onChange: (value: Set<DeliveryUiStatus>) => void;
  deliveries: DeliveryViewModel[];
  testID?: string;
}

function formatSummary(filters: ReadonlySet<DeliveryUiStatus>): string {
  if (isAllUiStatusesSelected(filters)) {
    return ptBR.home.filter.all;
  }
  const labels = DELIVERY_UI_STATUSES.filter((status) => filters.has(status)).map(
    (status) => STATUS_LABELS[status],
  );
  return labels.join(', ');
}

function FilterCheckbox({ checked }: { checked: boolean }) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: tokens.radius.sm,
        borderWidth: 2,
        borderColor: checked ? colors.accent : colors.borderDefault,
        backgroundColor: checked ? colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <Text style={{ color: colors.textOnAccent, fontSize: tokens.text.xs, fontWeight: tokens.weight.bold }}>
          ✓
        </Text>
      ) : null}
    </View>
  );
}

export function DeliveryStatusFilter({
  value,
  onChange,
  deliveries,
  testID = 'home-filter',
}: DeliveryStatusFilterProps) {
  const { colors, tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<DeliveryUiStatus>>(() => new Set(value));

  const counts = useMemo(() => countDeliveriesByUiStatus(deliveries), [deliveries]);
  const summary = useMemo(() => formatSummary(value), [value]);
  const allSelected = isAllUiStatusesSelected(draft);

  useEffect(() => {
    if (open) {
      setDraft(new Set(value));
    }
  }, [open, value]);

  function handleToggleAll() {
    if (!allSelected) {
      setDraft(createAllUiStatusSet());
    }
  }

  function handleToggleStatus(status: DeliveryUiStatus) {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function handleApply() {
    onChange(new Set(draft));
    setOpen(false);
  }

  function renderOption(
    key: string,
    label: string,
    checked: boolean,
    onPress: () => void,
    count?: number,
  ) {
    return (
      <Pressable
        key={key}
        testID={`${testID}-option-${key}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.space[3],
          paddingVertical: tokens.space[3],
          paddingHorizontal: tokens.space[2],
          borderRadius: tokens.radius.md,
          backgroundColor: checked ? colors.accentSurface : 'transparent',
          borderWidth: 1,
          borderColor: checked ? colors.accentBorder : 'transparent',
        }}
      >
        <FilterCheckbox checked={checked} />
        <Text
          style={{
            flex: 1,
            color: checked ? colors.textPrimary : colors.textSecondary,
            fontSize: tokens.text.base,
            fontWeight: checked ? tokens.weight.semibold : tokens.weight.regular,
          }}
        >
          {label}
        </Text>
        {count !== undefined ? (
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, fontWeight: tokens.weight.medium }}>
            {count}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={{ marginBottom: tokens.space[8] }}>
      <Pressable
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        accessibilityLabel={ptBR.home.filter.button}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surfacePanel,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          borderRadius: tokens.radius.md,
          paddingHorizontal: tokens.space[4],
          paddingVertical: tokens.space[3],
          minHeight: 48,
        }}
      >
        <View style={{ flex: 1, gap: tokens.space[1] }}>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, fontWeight: tokens.weight.medium }}>
            {ptBR.home.filter.button}
          </Text>
          <Text
            style={{ color: colors.textPrimary, fontSize: tokens.text.sm, fontWeight: tokens.weight.semibold }}
            numberOfLines={2}
          >
            {summary}
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            testID={`${testID}-modal`}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              padding: tokens.space[4],
              gap: tokens.space[4],
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.lg,
                fontWeight: tokens.weight.bold,
                color: colors.textPrimary,
              }}
            >
              {ptBR.home.filter.title}
            </Text>

            <View style={{ gap: tokens.space[1] }}>
              {renderOption('all', ptBR.home.filter.all, allSelected, handleToggleAll, counts.all)}
              {DELIVERY_UI_STATUSES.map((status) =>
                renderOption(
                  status,
                  STATUS_LABELS[status],
                  draft.has(status),
                  () => handleToggleStatus(status),
                  counts[status],
                ),
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: tokens.space[3] }}>
              <Button
                label={ptBR.common.cancel}
                variant="secondary"
                onPress={() => setOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                testID={`${testID}-apply`}
                label={ptBR.home.filter.apply}
                onPress={handleApply}
                disabled={draft.size === 0}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

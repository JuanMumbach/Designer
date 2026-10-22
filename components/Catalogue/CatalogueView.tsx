import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { COLORS, RADII } from '../../constants/theme';
import Thumbnail from '../Thumbnail';
import FormPanel, { FormPanelAction } from '../Editors/FormPanel';
import { ManagerAction, ManagerNotice, ManagerSearch } from '../Editors/ManagerControls';

export type CardSize = 'large' | 'compact';

export interface CatalogueItem {
  id: string;
  name: string;
  subtitle?: string;
  badge?: string;
  thumbnailUri?: string | null;
}

export interface CatalogueGroup {
  key: string;
  label: string;
  items: CatalogueItem[];
}

export interface CatalogueHeaderAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}

export interface CatalogueOption {
  key: string;
  label: string;
}

export default function CatalogueView({
  title,
  backLabel,
  onBack,
  headerActions,
  contextLabel,
  groups,
  groupOptions,
  groupKey,
  onGroupKeyChange,
  query,
  onQueryChange,
  searchPlaceholder,
  loading = false,
  loadingText = 'Cargando...',
  error,
  onRetry,
  emptyText,
  selectedId,
  onSelect,
  onOpen,
  openLabel,
  itemIcon = 'cube-outline',
  storageKey,
  inspectorTitle,
  inspectorContent,
  inspectorEmptyText = 'Selecciona un elemento para ver sus detalles.',
  inspectorActions,
  tabs,
  activeTab,
  onTabChange,
  toolbar,
}: {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  headerActions?: CatalogueHeaderAction[];
  contextLabel?: string;
  groups: CatalogueGroup[];
  groupOptions?: CatalogueOption[];
  groupKey?: string;
  onGroupKeyChange?: (key: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  loading?: boolean;
  loadingText?: string;
  error?: string;
  onRetry?: () => void;
  emptyText: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  openLabel?: string;
  itemIcon?: React.ComponentProps<typeof Ionicons>['name'];
  storageKey: string;
  inspectorTitle?: string;
  inspectorContent?: React.ReactNode;
  inspectorEmptyText?: string;
  inspectorActions?: { primary?: FormPanelAction; secondary?: FormPanelAction; danger?: FormPanelAction };
  tabs?: CatalogueOption[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  toolbar?: React.ReactNode;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;
  const [cardSize, setCardSize] = useState<CardSize>('large');
  const cardSizeLoadedRef = useRef(false);
  const lastPressRef = useRef({ id: '', time: 0 });

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed === 'large' || parsed === 'compact') setCardSize(parsed);
      })
      .catch(() => {})
      .finally(() => {
        cardSizeLoadedRef.current = true;
      });
  }, [storageKey]);

  useEffect(() => {
    if (!cardSizeLoadedRef.current) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(cardSize)).catch(() => {});
  }, [cardSize, storageKey]);

  const handlePress = (id: string) => {
    const now = Date.now();
    const last = lastPressRef.current;
    if (onOpen && last.id === id && now - last.time < 300) {
      lastPressRef.current = { id: '', time: 0 };
      onOpen(id);
      return;
    }
    lastPressRef.current = { id, time: now };
    onSelect(id);
  };

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  const renderSegmented = (
    options: CatalogueOption[],
    activeKey: string | undefined,
    onChange: ((key: string) => void) | undefined
  ) => (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
            onPress={() => onChange?.(option.key)}
          >
            <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderOpenAction = (id: string, compact: boolean) => {
    if (!onOpen || !openLabel) return null;
    return (
      <Pressable
        accessibilityRole="button"
        hitSlop={compact ? 4 : undefined}
        style={({ pressed }) => [
          compact ? styles.openChip : styles.cardOpen,
          pressed && styles.openPressed,
        ]}
        onPress={() => onOpen(id)}
      >
        <Text style={compact ? styles.openChipText : styles.cardOpenText}>{openLabel}</Text>
      </Pressable>
    );
  };

  const renderLargeCard = (item: CatalogueItem) => {
    const isSelected = selectedId === item.id;
    return (
      <View key={item.id} style={[styles.card, isSelected && styles.cardSelected]}>
        <Pressable style={styles.cardMain} onPress={() => handlePress(item.id)}>
          <View style={styles.cardThumb}>
            <Thumbnail
              uri={item.thumbnailUri}
              width="100%"
              height={150}
              icon={itemIcon}
              radius={RADII.sm}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardName, isSelected && styles.cardNameSelected]} numberOfLines={1}>
              {item.name}
            </Text>
            {!!item.subtitle && (
              <Text style={styles.cardMeta} numberOfLines={1}>{item.subtitle}</Text>
            )}
            {!!item.badge && (
              <Text style={styles.cardBadge} numberOfLines={1}>{item.badge}</Text>
            )}
          </View>
        </Pressable>
        {renderOpenAction(item.id, false)}
      </View>
    );
  };

  const renderPill = (item: CatalogueItem) => {
    const isSelected = selectedId === item.id;
    return (
      <View key={item.id} style={[styles.pill, isSelected && styles.pillSelected]}>
        <Pressable style={styles.pillInfo} onPress={() => handlePress(item.id)}>
          <View style={styles.pillThumb}>
            <Thumbnail uri={item.thumbnailUri} size={32} icon={itemIcon} />
          </View>
          <Text style={[styles.pillName, isSelected && styles.pillNameSelected]} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
        {renderOpenAction(item.id, true)}
      </View>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      );
    }
    if (totalItems === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      );
    }
    return (
      <View style={styles.content}>
        <View style={styles.listColumn}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group) => (
              <View key={group.key} style={styles.groupSection}>
                <Text style={styles.groupTitle}>
                  {group.label}
                  <Text style={styles.groupCount}>{' · '}{group.items.length}</Text>
                </Text>
                <View style={cardSize === 'large' ? styles.cardGrid : styles.pillGrid}>
                  {group.items.map((item) => (cardSize === 'large' ? renderLargeCard(item) : renderPill(item)))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
        {isWide && renderInspector()}
      </View>
    );
  };

  const renderInspector = () => (
    <View style={styles.inspectorColumn}>
      {inspectorContent ? (
        <FormPanel
          title={inspectorTitle}
          primaryAction={inspectorActions?.primary}
          secondaryAction={inspectorActions?.secondary}
          dangerAction={inspectorActions?.danger}
        >
          {inspectorContent}
        </FormPanel>
      ) : (
        <View style={styles.inspectorEmpty}>
          <Text style={styles.inspectorEmptyText}>{inspectorEmptyText}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={onBack}
          >
            <Text style={styles.backButtonText}>{backLabel ?? '← Volver'}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        {title ? (
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={styles.headerFill} />
        )}
        <View style={styles.headerActions}>
          {(headerActions ?? []).map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              disabled={action.disabled}
              style={({ pressed }) => [
                action.primary ? styles.primaryAction : styles.secondaryAction,
                (pressed || action.disabled) && styles.actionDim,
              ]}
              onPress={action.onPress}
            >
              <Text style={action.primary ? styles.primaryActionText : styles.secondaryActionText}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.statusRow}>
        {!!tabs && tabs.length > 1 && renderSegmented(tabs, activeTab, onTabChange)}
        <Text style={styles.statusText} numberOfLines={1}>{contextLabel}</Text>
        <View style={styles.statusActions}>
          {renderSegmented(
            [
              { key: 'large', label: 'Grande' },
              { key: 'compact', label: 'Compacta' },
            ],
            cardSize,
            (key) => setCardSize(key as CardSize)
          )}
          {!!groupOptions && groupOptions.length > 1 && renderSegmented(groupOptions, groupKey, onGroupKeyChange)}
        </View>
      </View>

      <View style={styles.searchSection}>
        {toolbar}
        <ManagerSearch value={query} onChangeText={onQueryChange} placeholder={searchPlaceholder} />
        {!!error && <ManagerNotice message={error} error />}
        {!!error && !!onRetry && <ManagerAction label="Reintentar" onPress={onRetry} disabled={loading} />}
      </View>
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  headerSpacer: {
    width: 0,
  },
  headerFill: {
    flex: 1,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.border,
  },
  backButtonPressed: {
    backgroundColor: COLORS.borderStrong,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: COLORS.textHeading,
    fontSize: 12,
    fontWeight: '600',
  },
  actionDim: {
    opacity: 0.6,
  },
  statusRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  statusActions: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    padding: 2,
  },
  segmentButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  segmentButtonTextActive: {
    color: COLORS.white,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  listColumn: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  list: {
    padding: 12,
    paddingBottom: 24,
  },
  groupSection: {
    marginBottom: 18,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupCount: {
    color: COLORS.textFaint,
    fontWeight: '600',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexBasis: 230,
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 320,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: 12,
    gap: 10,
  },
  cardSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  cardMain: {
    alignItems: 'center',
    gap: 10,
  },
  cardThumb: {
    width: '100%',
    alignItems: 'center',
  },
  cardBody: {
    alignItems: 'center',
    gap: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textBody,
    textAlign: 'center',
  },
  cardNameSelected: {
    color: COLORS.primary,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textFaint,
    fontWeight: '600',
  },
  cardBadge: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cardOpen: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  openPressed: {
    backgroundColor: COLORS.borderStrong,
  },
  cardOpenText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  pillSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  pillInfo: {
    maxWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillThumb: {
    marginRight: 8,
  },
  pillName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textBody,
  },
  pillNameSelected: {
    color: COLORS.primary,
  },
  openChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: COLORS.border,
  },
  openChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  inspectorColumn: {
    width: 320,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  inspectorEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  inspectorEmptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});

export const inspectorStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
  },
});

export function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={inspectorStyles.row}>
      <Text style={inspectorStyles.label}>{label}</Text>
      <Text style={inspectorStyles.value}>{value}</Text>
    </View>
  );
}

import React from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, RADII } from '../../constants/theme';
import { ManagerAction } from './ManagerControls';

export interface FormPanelTab {
  key: string;
  label: string;
}

export interface FormPanelAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function FormPanel({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  primaryAction,
  secondaryAction,
  dangerAction,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  tabs?: FormPanelTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: React.ReactNode;
  primaryAction?: FormPanelAction;
  secondaryAction?: FormPanelAction;
  dangerAction?: FormPanelAction;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const hasFooter = !!(primaryAction || secondaryAction || dangerAction);
  return (
    <View style={styles.container}>
      {(!!title || !!subtitle) && (
        <View style={styles.header}>
          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
        </View>
      )}
      {!!tabs && tabs.length > 1 && (
        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => onTabChange?.(tab.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {hasFooter && (
        <View style={styles.footer}>
          {!!dangerAction && (
            <ManagerAction danger label={dangerAction.label} onPress={dangerAction.onPress} disabled={dangerAction.disabled} />
          )}
          <View style={styles.footerSpacer} />
          {!!secondaryAction && (
            <ManagerAction label={secondaryAction.label} onPress={secondaryAction.onPress} disabled={secondaryAction.disabled} />
          )}
          {!!primaryAction && (
            <ManagerAction primary label={primaryAction.label} onPress={primaryAction.onPress} disabled={primaryAction.disabled} />
          )}
        </View>
      )}
    </View>
  );
}

export const formStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgAlt,
    fontSize: 14,
    color: COLORS.text,
  },
  inputDisabled: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textFaint,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  field: {
    gap: 2,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  chipTextActive: {
    color: COLORS.white,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flexShrink: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  footerSpacer: {
    flex: 1,
  },
});

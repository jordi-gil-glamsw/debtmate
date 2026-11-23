import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useOnboarded } from '@/store/store';
import { colors, fonts, radius, space } from '@/theme/tokens';

/**
 * Web tab layout (iOS/Android use NativeTabs in _layout.tsx).
 * One navigator for every width; only its presentation changes:
 * a sidebar on desktop, a bottom bar on narrow (phone) browsers.
 */

const TABS: { name: string; href: '/' | '/persones' | '/grups' | '/activitat' | '/ajustos'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Inici', icon: 'home' },
  { name: 'persones', href: '/persones', label: 'Persones', icon: 'people' },
  { name: 'grups', href: '/grups', label: 'Grups', icon: 'group' },
  { name: 'activitat', href: '/activitat', label: 'Activitat', icon: 'chart' },
  { name: 'ajustos', href: '/ajustos', label: 'Ajustos', icon: 'settings' },
];

type ItemProps = Omit<TabTriggerSlotProps, 'ref'> & { label: string; icon: IconName; compact?: boolean };

function NavItem({ label, icon, compact, isFocused, ...pressable }: ItemProps) {
  const color = isFocused ? (compact ? colors.accent : colors.text) : colors.textMuted;
  return (
    <Pressable
      {...pressable}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
          compact ? styles.bottomItem : styles.sideItem,
          !compact && (isFocused || hovered) && { backgroundColor: isFocused ? colors.surfaceRaised : colors.surface },
        ];
      }}>
      <Icon name={icon} size={compact ? 22 : 20} color={color} />
      <AppText variant={compact ? 'small' : 'bodyStrong'} color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function WebTabsLayout() {
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  const onboarded = useOnboarded();
  if (!onboarded) return <Redirect href="/benvinguda" />;

  const triggers = (compact: boolean) =>
    TABS.map((t) => (
      <TabTrigger key={t.name} name={t.name} asChild>
        <NavItem label={t.label} icon={t.icon} compact={compact} />
      </TabTrigger>
    ));

  return (
    <Tabs style={[styles.root, desktop && styles.row]}>
      {desktop ? (
        <View style={styles.sidebar} accessibilityRole="tablist">
          <AppText style={styles.brand}>debtmate</AppText>
          <View style={styles.sideItems}>{triggers(false)}</View>
        </View>
      ) : null}

      <View style={styles.main}>
        <TabSlot />
      </View>

      {!desktop ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
          {triggers(true)}
        </View>
      ) : null}

      {/* Route declarations; the visible triggers above reference them by name. */}
      <TabList style={styles.hidden}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  hidden: { display: 'none' },
  sidebar: {
    width: 240,
    paddingVertical: 28,
    paddingHorizontal: space.xl,
    gap: 28,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceRaised,
  },
  brand: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, paddingLeft: space.md },
  sideItems: { gap: space.xs },
  sideItem: {
    height: 44,
    borderRadius: radius.md - 2,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: space.sm },
});

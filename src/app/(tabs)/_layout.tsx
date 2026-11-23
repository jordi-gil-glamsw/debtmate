import { NativeTabs } from 'expo-router/native-tabs';

import { colors, fonts } from '@/theme/tokens';

/** Native tab bar: UITabBar on iOS (Liquid Glass on iOS 26+), Material bottom navigation on Android. */
export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.surfaceRaised}
      tintColor={colors.accent}
      iconColor={{ default: colors.textMuted, selected: colors.accent }}
      indicatorColor={colors.surfaceMuted}
      labelStyle={{
        default: { color: colors.textMuted, fontFamily: fonts.bodySemiBold },
        selected: { color: colors.accent, fontFamily: fonts.bodySemiBold },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inici</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="persones">
        <NativeTabs.Trigger.Label>Persones</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activitat">
        <NativeTabs.Trigger.Label>Activitat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ajustos">
        <NativeTabs.Trigger.Label>Ajustos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

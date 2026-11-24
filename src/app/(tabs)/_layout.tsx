import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { useOnboarded } from '@/store/store';
import { colors, fonts } from '@/theme/tokens';

/** Native tab bar: UITabBar on iOS (Liquid Glass on iOS 26+), Material bottom navigation on Android. */
export default function TabsLayout() {
  const onboarded = useOnboarded();
  if (!onboarded) return <Redirect href="/benvinguda" />;
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
      {/* iOS adds its own top inset to the first tab's ScrollView on top of Screen's safe-area
          padding (double top margin). Screen already handles every inset, so opt out here. */}
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Inici</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="persones">
        <NativeTabs.Trigger.Label>Persones</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="grups">
        <NativeTabs.Trigger.Label>Grups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
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

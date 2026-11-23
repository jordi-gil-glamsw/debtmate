import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { toISODate } from '@/domain/dates';
import { movementsToCsv } from '@/domain/export';
import { confirm, notify, shareText } from '@/lib/dialogs';
import { eraseAllData, loadSampleData, readState, updateSettings, useSettings } from '@/store/store';
import { colors, radius, space, touchTarget } from '@/theme/tokens';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="overline" color={colors.textMuted} accessibilityRole="header" style={{ marginLeft: space.xs }}>
        {title}
      </AppText>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({ label, icon, onPress, right, danger, last }: {
  label: string;
  icon: IconName;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  const content = (
    <>
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.textMuted} />
      <AppText variant="body" color={danger ? colors.danger : colors.text} style={{ flex: 1 }}>
        {label}
      </AppText>
      {right ?? (onPress ? <Icon name="chevronRight" size={14} color={colors.textMuted} /> : null)}
    </>
  );
  const style = [styles.row, !last && styles.rowDivider];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

async function toggleBiometricLock(next: boolean) {
  if (!next) {
    updateSettings({ biometricLock: false });
    return;
  }
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) {
    notify('No disponible', 'Configura Face ID, Touch ID o l’empremta als ajustos del dispositiu.');
    return;
  }
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Activa el bloqueig', cancelLabel: 'Cancel·la' });
  if (result.success) updateSettings({ biometricLock: true });
}

async function exportCsv() {
  const { contacts, movements } = readState();
  if (movements.length === 0) {
    notify('Res a exportar', 'Encara no hi ha cap moviment.');
    return;
  }
  await shareText(movementsToCsv(contacts, movements), `debtmate-${toISODate(new Date())}.csv`);
}

async function askLoadSample() {
  const hasData = readState().movements.length > 0;
  if (hasData && !(await confirm('Carregar dades d’exemple', 'Se substituiran les dades actuals.', 'Substitueix', true))) return;
  loadSampleData();
}

async function askErase() {
  if (await confirm('Esborrar totes les dades', 'Aquesta acció no es pot desfer.', 'Esborra', true)) eraseAllData();
}

export default function SettingsScreen() {
  const settings = useSettings();
  const biometricLabel = Platform.OS === 'ios' ? 'Bloqueja amb Face ID' : 'Bloqueja amb empremta';

  return (
    <Screen title="Ajustos">
      <View style={styles.account}>
        <View style={styles.accountAvatar}>
          <AppText variant="bodyStrong">Jo</AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">Dades en aquest dispositiu</AppText>
          <AppText variant="small" color={colors.textMuted}>
            La sincronització amb compte arribarà aviat
          </AppText>
        </View>
      </View>

      {Platform.OS !== 'web' ? (
        <Section title="Seguretat">
          <Row
            label={biometricLabel}
            icon="lock"
            last
            right={
              <Switch
                value={settings.biometricLock}
                onValueChange={toggleBiometricLock}
                accessibilityLabel={biometricLabel}
                trackColor={{ true: colors.success, false: colors.surfaceMuted }}
              />
            }
          />
        </Section>
      ) : null}

      <Section title="Dades">
        <Row label="Exporta a CSV" icon="export" onPress={exportCsv} />
        <Row label="Carrega dades d'exemple" icon="receipt" onPress={askLoadSample} />
        <Row label="Esborra totes les dades" icon="trash" onPress={askErase} danger last />
      </Section>

      <AppText variant="small" color={colors.textMuted} style={{ textAlign: 'center' }}>
        DebtMate {Constants.expoConfig?.version ?? ''}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 14, minHeight: touchTarget + 6 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

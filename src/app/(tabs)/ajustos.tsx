import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { formatShortDate, toISODate } from '@/domain/dates';
import { movementsToCsv } from '@/domain/export';
import { planReminders } from '@/domain/reminders';
import { authErrorMessage, deleteAccount, hasUnsyncedChanges, signOut } from '@/features/account/auth';
import { accountName, cloudEnabled, useSession } from '@/features/account/session';
import {
  getReminderPermission,
  remindersSupported,
  requestReminderPermission,
  sendTestReminder,
  type ReminderPermission,
} from '@/features/reminders/notifications';
import { confirm, notify, shareText } from '@/lib/dialogs';
import { eraseAllData, loadSampleData, readState, updateSettings, useSettings, useSyncMeta } from '@/store/store';
import { hasLocalChanges, type SyncMeta } from '@/sync/merge';
import { syncNow, useSyncStatus, type SyncStatus } from '@/sync/sync';
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

async function toggleReminders(next: boolean) {
  if (!next) {
    updateSettings({ reminders: false });
    return;
  }
  const permission = await requestReminderPermission();
  if (permission !== 'granted') {
    const ok = await confirm(
      'Notificacions desactivades',
      'Per rebre els recordatoris, permet les notificacions de DebtMate als ajustos del dispositiu.',
      'Obre els ajustos',
    );
    if (ok) Linking.openSettings();
    return;
  }
  updateSettings({ reminders: true });
}

/** Development only: a real planned reminder (or a sample) in 5 seconds. */
async function testReminder() {
  if ((await requestReminderPermission()) !== 'granted') {
    notify('Sense permís', 'Permet les notificacions per provar els recordatoris.');
    return;
  }
  const { contacts, movements } = readState();
  // Plan as if it were far in the past, so every pending due date counts.
  const sample = planReminders(contacts, movements, new Date(2000, 0, 1))[0];
  await sendTestReminder(sample);
  notify('Recordatori programat', 'Arribarà d’aquí a 5 segons. Surt de l’app per veure’l com a notificació.');
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

async function askErase(signedIn: boolean) {
  const message = signedIn
    ? 'S’esborraran d’aquest dispositiu i del teu compte. Aquesta acció no es pot desfer.'
    : 'Aquesta acció no es pot desfer.';
  if (await confirm('Esborrar totes les dades', message, 'Esborra', true)) eraseAllData();
}

async function askSignOut() {
  const unsynced = await hasUnsyncedChanges();
  const warning = unsynced ? 'Hi ha canvis que encara no s’han pogut desar al compte i es perdran. ' : '';
  const ok = await confirm(
    'Tancar la sessió',
    `${warning}Les dades es queden al teu compte i s’esborraran d’aquest dispositiu.`,
    'Tanca la sessió',
    true,
  );
  if (!ok) return;
  try {
    await signOut();
  } catch (e) {
    notify('No s’ha pogut tancar la sessió', authErrorMessage(e));
  }
}

async function askDeleteAccount() {
  const ok = await confirm(
    'Eliminar el compte',
    'S’eliminaran el compte i totes les dades, al núvol i en aquest dispositiu. No es pot desfer.',
    'Elimina el compte',
    true,
  );
  if (!ok) return;
  try {
    await deleteAccount();
  } catch (e) {
    notify('No s’ha pogut eliminar el compte', authErrorMessage(e));
  }
}

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  return toISODate(d) === toISODate(new Date()) ? `avui a les ${time}` : `${formatShortDate(toISODate(d))}, ${time}`;
}

function syncLabel(status: SyncStatus, meta: SyncMeta): string {
  if (status.state === 'syncing') return 'Sincronitzant…';
  if (status.state === 'error') return 'No s’ha pogut sincronitzar. Ho tornarem a provar.';
  if (hasLocalChanges(meta)) return 'Hi ha canvis pendents de sincronitzar';
  return meta.lastSyncedAt ? `Sincronitzat ${formatSyncedAt(meta.lastSyncedAt)}` : 'Sincronitzat';
}

function AccountCard() {
  const session = useSession();
  const status = useSyncStatus();
  const meta = useSyncMeta();

  if (session) {
    const name = accountName(session);
    return (
      <View style={styles.account}>
        <Avatar name={name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="small" color={status.state === 'error' ? colors.danger : colors.textMuted}>
            {syncLabel(status, meta)}
          </AppText>
        </View>
        {status.state === 'syncing' ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Icon name={status.state === 'error' ? 'cloud' : 'cloudDone'} size={20} color={colors.textMuted} />
        )}
      </View>
    );
  }

  const content = (
    <>
      <View style={styles.accountAvatar}>
        <AppText variant="bodyStrong">Jo</AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">Dades en aquest dispositiu</AppText>
        <AppText variant="small" color={cloudEnabled ? colors.accent : colors.textMuted}>
          {cloudEnabled ? 'Inicia sessió per sincronitzar-les' : 'Sense compte: no se sincronitzen'}
        </AppText>
      </View>
      {cloudEnabled ? <Icon name="chevronRight" size={14} color={colors.textMuted} /> : null}
    </>
  );

  return cloudEnabled ? (
    <Pressable
      onPress={() => router.push('/compte')}
      accessibilityRole="button"
      accessibilityLabel="Inicia sessió per sincronitzar les dades"
      style={({ pressed }) => [styles.account, pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.account}>{content}</View>
  );
}

export default function SettingsScreen() {
  const settings = useSettings();
  const session = useSession();
  const [reminderPermission, setReminderPermission] = useState<ReminderPermission>('undetermined');
  const checkPermission = useCallback(() => {
    getReminderPermission().then(setReminderPermission, () => {});
  }, []);

  // Re-check when coming back from the system settings.
  useEffect(() => {
    if (!remindersSupported) return;
    checkPermission();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);
  const biometricLabel = Platform.OS === 'ios' ? 'Bloqueja amb Face ID' : 'Bloqueja amb empremta';

  return (
    <Screen title="Ajustos">
      <AccountCard />

      {session ? (
        <Section title="Compte">
          <Row label="Sincronitza ara" icon="sync" onPress={() => syncNow()} />
          <Row label="Tanca la sessió" icon="signOut" onPress={askSignOut} />
          <Row label="Elimina el compte" icon="deleteAccount" onPress={askDeleteAccount} danger last />
        </Section>
      ) : null}

      {remindersSupported ? (
        <Section title="Recordatoris">
          {__DEV__ ? <Row label="Prova un recordatori (5 s)" icon="bell" onPress={testReminder} /> : null}
          <Row
            label="Avisa'm el dia límit"
            icon="bell"
            last
            right={
              <Switch
                value={settings.reminders && reminderPermission === 'granted'}
                onValueChange={(next) => toggleReminders(next).then(checkPermission)}
                accessibilityLabel="Avisa'm el dia de la data límit"
                trackColor={{ true: colors.success, false: colors.surfaceMuted }}
              />
            }
          />
        </Section>
      ) : null}
      {remindersSupported ? (
        <AppText variant="small" color={colors.textMuted} style={styles.footnote}>
          {reminderPermission === 'denied'
            ? 'Les notificacions estan desactivades als ajustos del dispositiu.'
            : 'A les 10:00 del dia acordat, si encara queda alguna cosa pendent.'}
        </AppText>
      ) : null}

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
        <Row label="Esborra totes les dades" icon="trash" onPress={() => askErase(!!session)} danger last />
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
  footnote: { marginTop: -space.md, marginHorizontal: space.xs },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

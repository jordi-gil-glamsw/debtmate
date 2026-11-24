import Head from 'expo-router/head';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { legal } from '@/config/legal';
import { formatShortDate } from '@/domain/dates';
import { colors, space } from '@/theme/tokens';

/**
 * Privacy policy. Public (no onboarding or account needed) so the stores and the web can link to
 * it directly: /privacitat. Keep it in line with what the app really does (see src/sync,
 * src/store and supabase/): when the data handling changes, update this text and legal.updatedAt.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <AppText variant="body" color={colors.textMuted} style={styles.p}>
      {children}
    </AppText>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <View style={styles.item}>
      <AppText variant="body" color={colors.textMuted}>
        •
      </AppText>
      <AppText variant="body" color={colors.textMuted} style={styles.p}>
        {children}
      </AppText>
    </View>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function PrivacyScreen() {
  return (
    <Screen>
      <Head>
        <title>Política de privacitat · Ovia</title>
        <meta name="description" content="Com tracta Ovia les teves dades: què desa, on, amb qui es comparteix i com les pots esborrar." />
      </Head>

      <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Torna" style={styles.back} hitSlop={8}>
        <Icon name="back" size={16} color={colors.accent} />
        <AppText variant="bodyStrong" color={colors.accent}>
          Ovia
        </AppText>
      </Pressable>

      <View style={styles.header}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Política de privacitat
        </AppText>
        <AppText variant="caption" color={colors.textFaint}>
          Última actualització: {formatShortDate(legal.updatedAt)} {legal.updatedAt.slice(0, 4)}
        </AppText>
      </View>

      <P>
        Ovia és una app per apuntar els deutes amb amics i família. Aquesta pàgina explica, sense lletra petita, quines
        dades fa servir, on es guarden i què en pots fer.
      </P>

      <Section title="L’essencial">
        <Item>Les teves dades són teves: no les venem, no les fem servir per a publicitat i no les compartim amb ningú més que els serveis necessaris per fer funcionar l’app.</Item>
        <Item>No hi ha anàlisi d’ús, publicitat ni seguiment.</Item>
        <Item>El compte és opcional. Sense compte, les dades no surten del teu dispositiu.</Item>
        <Item>Ho pots esborrar tot, també el compte, des d’Ajustos.</Item>
      </Section>

      <Section title="Quines dades tractem">
        <P>Només les que tu escrius a l’app:</P>
        <Item>Els noms de les persones amb qui tens deutes o comparteixes despeses.</Item>
        <Item>Els moviments: imports, concepte, data, data límit, nota i forma de pagament.</Item>
        <Item>Els grups i les despeses compartides.</Item>
        <P>
          Ovia no accedeix a la teva llibreta de contactes, a la ubicació, ni a les teves fotos (les fotos de tiquets no
          estan actives en aquesta versió).
        </P>
        <P>Si crees un compte, a més:</P>
        <Item>
          El teu correu electrònic i el nom que et comparteixin Apple o Google si inicies sessió amb ells (Apple et deixa
          amagar el correu).
        </Item>
        <P>
          Les persones que apuntes poden ser tercers: fes servir Ovia només per a ús personal i apunta només el que
          necessitis, com ara un nom o un sobrenom.
        </P>
      </Section>

      <Section title="On es guarden">
        <Item>
          <AppText variant="bodyStrong" color={colors.text}>
            Al teu dispositiu.
          </AppText>{' '}
          Les dades es desen a la memòria de l’app (a la base de dades local del mòbil o a l’emmagatzematge del
          navegador al web). Si no tens compte, no en surten mai.
        </Item>
        <Item>
          <AppText variant="bodyStrong" color={colors.text}>
            Al núvol, només si inicies sessió.
          </AppText>{' '}
          Fem una còpia al nostre proveïdor de base de dades i autenticació, Supabase, per sincronitzar les dades entre
          els teus dispositius. Cada usuari només pot llegir i modificar les seves pròpies dades (seguretat a nivell de
          fila) i la comunicació va xifrada.
        </Item>
      </Section>

      <Section title="Amb qui es comparteixen">
        <P>Només amb els serveis que fan falta per fer funcionar l’app, que tracten les dades en nom nostre:</P>
        <Item>Supabase: base de dades i autenticació del compte.</Item>
        <Item>Apple i Google: només si tries iniciar sessió amb ells.</Item>
        <Item>Expo (EAS): allotjament del web i distribució de l’app.</Item>
        <P>
          No hi ha cap altre destinatari. Quan comparteixes el resum d’un deute o d’un grup (per exemple per WhatsApp),
          ho fas tu mateix amb el full de compartir del sistema: Ovia no envia res per compte seu.
        </P>
      </Section>

      <Section title="Permisos del dispositiu">
        <Item>
          Notificacions: els recordatoris del dia límit són locals; es programen al teu dispositiu i no passen per cap
          servidor.
        </Item>
        <Item>
          Face ID o empremta: només serveixen per bloquejar l’app. Els gestiona el sistema; Ovia no pot veure ni desar
          cap dada biomètrica.
        </Item>
      </Section>

      <Section title="Els teus drets">
        <Item>Accedir-hi i portar-te-les: pots exportar els moviments a CSV des d’Ajustos.</Item>
        <Item>Corregir-les: pots editar o esborrar qualsevol persona, moviment o despesa.</Item>
        <Item>
          Esborrar-les: «Esborra totes les dades» elimina les dades del dispositiu (i del compte, si has iniciat sessió).
          «Elimina el compte» esborra el compte i totes les dades del núvol, i no es pot desfer.
        </Item>
        <Item>
          Tancar la sessió esborra les dades d’aquest dispositiu, però es queden al compte fins que l’eliminis.
        </Item>
        <P>
          Si creus que no tractem bé les teves dades, també pots reclamar davant l’autoritat de protecció de dades del
          teu país (a Espanya, l’Agència Espanyola de Protecció de Dades, aepd.es).
        </P>
      </Section>

      <Section title="Quant de temps les guardem">
        <P>
          Mentre tinguis les dades a l’app o el compte actiu. Quan elimines el compte, s’esborren les dades del núvol.
        </P>
      </Section>

      <Section title="Menors">
        <P>Ovia no està pensada per a menors de 14 anys i no en recull dades de manera intencionada.</P>
      </Section>

      <Section title="Canvis en aquesta política">
        <P>
          Si canviem la manera de tractar les dades, actualitzarem aquesta pàgina i la data de dalt. Si el canvi és
          important, t’ho avisarem a l’app.
        </P>
      </Section>

      {legal.contactEmail ? (
        <Section title="Contacte">
          <P>
            {legal.controllerName ? `${legal.controllerName} és el responsable del tractament. ` : ''}
            Per exercir els teus drets o per qualsevol dubte, escriu a{' '}
            <AppText
              variant="body"
              color={colors.accent}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${legal.contactEmail}`)}>
              {legal.contactEmail}
            </AppText>
            .
          </P>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 44 },
  header: { gap: space.xs },
  section: { gap: space.sm, marginTop: space.sm },
  p: { flexShrink: 1 },
  item: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
});

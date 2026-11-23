# DebtMate

App per controlar els deutes amb amics i família: què et deuen, què deus i com es van liquidant.
Una sola base de codi (Expo / React Native) per a **iOS i Android natius** i **web**.

Disseny de referència: direcció visual «B · Fosc fintech»
(llenç de dissenys: https://claude.ai/artifact/GV4sWCqkKhSDU5YAcRCSBz).

## Posar-la en marxa

```bash
npm install
npx expo start        # i escaneja el QR amb l'app Expo Go (iOS / Android), o prem "w" per al web
```

Ordres útils:

| Ordre | Què fa |
|---|---|
| `npm test` | Proves unitàries del domini (càlcul de saldos, imports, dates) |
| `npm run typecheck` | Comprovació de tipus TypeScript |
| `npm run lint` | ESLint |
| `npx expo-doctor` | Diagnòstic de dependències i configuració |

### iOS des de Windows

No cal un Mac:

- **Per provar**: instal·la *Expo Go* a l'iPhone i escaneja el QR de `npx expo start`.
  Face ID no funciona dins d'Expo Go; per provar-lo cal una *development build*.
- **Per compilar i publicar** (TestFlight / App Store): `npx eas-cli@latest build -p ios`
  compila al núvol; `npx eas-cli@latest submit -p ios` la puja a App Store Connect.
  Cal un compte d'Apple Developer (99 $/any). Per Android: `-p android` i un compte de Google Play (25 $, un sol cop).

## Comptes i sincronització (Supabase)

Sense configurar res, l'app funciona sense compte (les dades només es guarden al dispositiu).
Per activar els comptes:

1. Crea un projecte a [supabase.com](https://supabase.com) (el pla gratuït n'hi ha prou).
2. **SQL Editor**: enganxa i executa, per ordre, `0001_init.sql`, `0002_grants.sql`, `0004_groups.sql` i
   `0005_group_settle_split.sql` de
   `supabase/migrations/`.
   (`0003_receipts.sql` només cal si actives les fotos del tiquet; vegeu més avall.)
3. Copia `.env.example` a `.env.local` i omple'l amb la URL i la *publishable key*
   (*Project Settings → API Keys*). Reinicia `npx expo start`.
4. **Correu amb codi**: a *Authentication → Email Templates → Magic Link*, posa el codi al missatge,
   per exemple `<p>El teu codi de DebtMate: {{ .Token }}</p>`. Sense `{{ .Token }}` arriba un enllaç en lloc d'un codi.
5. **Adreces de retorn**: a *Authentication → URL Configuration → Redirect URLs*, afegeix
   `debtmate://**`, `exp://**` (per provar amb Expo Go) i l'adreça del web (p. ex. `http://localhost:8081`).
6. **Google**: a Google Cloud, crea un client OAuth de tipus *Web application* amb l'URI de redirecció
   `https://<projecte>.supabase.co/auth/v1/callback`. Després posa'n l'ID i el secret a *Authentication → Providers → Google*.
   Mentre la pantalla de consentiment de Google sigui en mode de proves, només hi entren els *Test users*;
   abans de publicar l'app, prem *Audience → Publish app*.
7. **Apple** (iOS):
   - Defineix `ios.bundleIdentifier` a `app.json`.
   - Al portal d'Apple Developer, activa *Sign in with Apple* per a aquest App ID.
   - Afegeix el bundle ID a *Providers → Apple → Client IDs*, i també `host.exp.Exponent` per provar-ho amb Expo Go.
8. **Eliminar el compte** (l'App Store ho exigeix): desplega `supabase/functions/delete-account`.
   Des del panell: *Edge Functions → Deploy a new function → Via Editor*, amb el nom `delete-account`.
   Amb la CLI: `npx supabase functions deploy delete-account`. Deixa activada la verificació de JWT.

Com funciona la sincronització (`src/sync/`):

- Cada canvi local queda marcat com a pendent.
- Amb la sessió iniciada, els canvis s'envien al núvol uns segons després de fer-los, en tornar a obrir l'app i en iniciar sessió.
- Després es baixen els canvis fets als altres dispositius.
- Si un canvi local encara no s'ha enviat, té prioritat sobre el del núvol.
- En tancar la sessió, les dades s'esborren del dispositiu però es queden al compte.

## Estructura

```
src/
  app/                 Rutes (Expo Router). Cada fitxer és una pantalla.
    (tabs)/            Pestanyes natives: Inici, Persones, Activitat, Ajustos
    persona/[id].tsx   Detall d'una persona
    nou.tsx            Full modal: nou deute
    pagament/[id].tsx  Full modal: registrar pagament
    benvinguda.tsx     Primera obertura
    compte.tsx         Full modal: iniciar sessió / crear compte
  domain/              Lògica pura (sense React): tipus, diners, saldos, dates, exportació CSV
  store/               Estat local persistent (SQLite a mòbil, localStorage al web)
  components/          Components d'interfície
  features/lock/       Bloqueig amb Face ID / empremta
  features/account/    Inici de sessió (Apple, Google, correu amb codi) i sessió
  sync/                Sincronització (regles pures a merge.ts, amb proves)
  lib/supabase.ts      Client de Supabase (null si no hi ha claus)
  theme/tokens.ts      Colors, tipografia i espaiats del disseny
supabase/migrations/   Esquema de base de dades amb seguretat per fila
supabase/functions/    Funció per eliminar el compte
```

Principis:

- **Diners en cèntims** (enters), mai decimals.
- **El saldo no es desa**: es calcula a partir dels moviments, de manera que no es pot desquadrar.
- **Natiu primer**: pestanyes natives (UITabBar / Material), fulls modals natius, icones SF Symbols a iOS
  i Material Symbols a Android, diàlegs i full de compartir del sistema.

## Estat actual

Fet:

- Apuntar deutes en els dos sentits, amb concepte i data límit opcional
- Pagaments totals o parcials (Bizum, efectiu, transferència…)
- Saldo per persona i global, progrés de devolució i activitat mensual
- Cerca i filtres de persones; esborrar moviments i persones
- Compartir el resum d'un deute (WhatsApp, Missatges…)
- Bloqueig amb Face ID / empremta
- Exportar a CSV; dades d'exemple
- Comptes opcionals (Apple, Google, correu amb codi), sincronització entre dispositius i eliminació del compte

- Web d'escriptori (≥ 1024 px): barra lateral, targetes de resum, taula de persones amb cerca
  i panell de detall; en finestres estretes, el mateix disseny que al mòbil amb barra inferior
- Canviar el nom de les persones; nota a cada moviment
- Foto del tiquet: **feta però desactivada** (fa servir Supabase Storage, pensat per a una versió de
  pagament). Per activar-la, segueix els passos de `src/config/features.ts`: migració 0003, tornar a
  desplegar `delete-account`, el connector `expo-image-picker` a `app.json` i `EXPO_PUBLIC_RECEIPT_PHOTOS=1`
- Selector de data natiu (data del moviment i data límit) i edició de moviments (tocar un moviment)
- Recordatoris: notificació local a les 10:00 del dia límit si encara hi ha deute pendent
  (iOS i Android; es recalculen amb cada canvi, també els sincronitzats)
- Grups i despeses compartides (estil Splitwise, però només amb els teus deutes): grups desats,
  qui ha pagat, qui hi era i repartiment a parts iguals (els cèntims sobrants, per a qui paga).
  Els deutes de cada persona es calculen a partir de les despeses (`src/domain/groups.ts`), no es
  desen a part. També: repartiment per imports concrets, «Liquida» per persona dins del grup (un
  pagament lligat al grup, que també compta al saldo total) i compartir el resum del grup o d’una
  despesa per WhatsApp

- Web publicat a https://debtmate.expo.app (EAS Hosting). Per tornar-lo a publicar: `npm run deploy:web`
  (cal `.env.local` amb les variables de Supabase, i haver fet `npx eas-cli@latest login`).
  Fa servir `web.output: "server"` perquè les rutes dinàmiques (`/persona/<id>`, `/grup/<id>`…)
  funcionin en entrar-hi directament o en recarregar

Pendent:

1. Publicar les apps (EAS Build)

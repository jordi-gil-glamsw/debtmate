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

## Estructura

```
src/
  app/                 Rutes (Expo Router). Cada fitxer és una pantalla.
    (tabs)/            Pestanyes natives: Inici, Persones, Activitat, Ajustos
    persona/[id].tsx   Detall d'una persona
    nou.tsx            Full modal: nou deute
    pagament/[id].tsx  Full modal: registrar pagament
    benvinguda.tsx     Primera obertura
  domain/              Lògica pura (sense React): tipus, diners, saldos, dates, exportació CSV
  store/               Estat local persistent (SQLite a mòbil, localStorage al web)
  components/          Components d'interfície
  features/lock/       Bloqueig amb Face ID / empremta
  theme/tokens.ts      Colors, tipografia i espaiats del disseny
supabase/migrations/   Esquema de base de dades per a la futura sincronització
```

Principis:

- **Diners en cèntims** (enters), mai decimals.
- **El saldo no es desa**: es calcula a partir dels moviments, de manera que no es pot desquadrar.
- **Natiu primer**: pestanyes natives (UITabBar / Material), fulls modals natius, icones SF Symbols a iOS
  i Material Symbols a Android, diàlegs i full de compartir del sistema.

## Estat actual

Fet (MVP local, sense compte):

- Apuntar deutes en els dos sentits, amb concepte i data límit opcional
- Pagaments totals o parcials (Bizum, efectiu, transferència…)
- Saldo per persona i global, progrés de devolució i activitat mensual
- Cerca i filtres de persones; esborrar moviments i persones
- Compartir el resum d'un deute (WhatsApp, Missatges…)
- Bloqueig amb Face ID / empremta
- Exportar a CSV; dades d'exemple

Pendent:

1. Comptes (Apple, Google, correu) i sincronització amb Supabase (esquema a `supabase/migrations`)
2. Recordatoris amb notificacions abans de la data límit
3. Disseny d'escriptori per al web (taula + panell de detall)
4. Foto del tiquet, selector de data, edició de moviments

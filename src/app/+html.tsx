import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML of the web build. Runs only on the server, so no window/document and no global CSS.
 *
 * What it adds on top of the default document, so the app behaves like an app once saved to the
 * iOS/Android home screen:
 * - the manifest, the apple-touch-icon and the app title (otherwise iOS uses a screenshot of the
 *   page as the icon),
 * - standalone mode, which hides the browser controls,
 * - `viewport-fit=cover` plus the safe-area padding, so the app fills the whole screen and the
 *   content stays clear of the notch, the status bar and the home indicator.
 */

// Keep in sync with colors.bg in src/theme/tokens.ts (the server document cannot import app code that uses RN).
const BG = '#0E0F13';

// On web, expo-router gives react-native-safe-area-context zero insets, so the safe areas are
// applied here with CSS env(). The bottom inset is handled by the bottom tab bar itself.
const css = `
html,body{background-color:${BG};color-scheme:dark}
body{overscroll-behavior:none;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
#root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}
`;

export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="ca" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        <title>Ovia</title>
        <meta name="application-name" content="Ovia" />
        <meta name="theme-color" content={BG} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Ovia" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />
        <style id="ovia-web-app" dangerouslySetInnerHTML={{ __html: css }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

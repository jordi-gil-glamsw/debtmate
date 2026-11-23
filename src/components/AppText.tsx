import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

const variants = StyleSheet.create({
  hero: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  amountLarge: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  amount: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] },
  largeTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
});

export type TextVariant = keyof typeof variants;

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
};

/** All app text goes through this component so typography stays consistent. Respects the user's font scaling. */
export function AppText({ variant = 'body', color = colors.text, style, ...rest }: Props) {
  return <Text {...rest} style={[variants[variant], { color }, style]} maxFontSizeMultiplier={1.6} />;
}

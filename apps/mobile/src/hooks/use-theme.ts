/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // useColorScheme() is 'light' | 'dark' | null | undefined — there is no
  // 'unspecified' value; fall back to light when the scheme is unresolved.
  const scheme = useColorScheme();

  return Colors[scheme ?? 'light'];
}

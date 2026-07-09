// `Label` and `Icon` are standalone named exports of the native-tabs module.
// They are NOT static members of `NativeTabs.Trigger` (which only exposes
// `.TabBar`), so `<NativeTabs.Trigger.Label>` resolves to `undefined` and React
// throws "Cannot read property 'displayName' of undefined" while rendering.
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  // useColorScheme() is typed 'light' | 'dark' | null | undefined — there is no
  // 'unspecified' value, and indexing Colors with null/undefined yields
  // `undefined`, which would crash on the first `colors.*` access. Fall back to
  // the light palette whenever the scheme is unresolved.
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon src={require('@/assets/images/tabIcons/home.png')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <Label>Scan</Label>
        {/* SF Symbol keeps us icon-asset-free on iOS (the primary platform);
            Android has no drawable yet and falls back to the label. */}
        <Icon sf="camera.viewfinder" />
      </NativeTabs.Trigger>

      {/* Explore retired in favor of Account (spec 002 FR-017 / critique D4). */}
      <NativeTabs.Trigger name="account">
        <Label>Account</Label>
        <Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

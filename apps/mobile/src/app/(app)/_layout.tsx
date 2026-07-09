/**
 * Signed-in group layout — the tab UI lives INSIDE the protected group so a
 * sign-out unmounts every authenticated surface (tabs included) in one guard
 * flip; keeping tabs at the root would leave app chrome visible to signed-out
 * users (research §7).
 */

import AppTabs from '@/components/app-tabs';

export default function AppLayout() {
  return <AppTabs />;
}

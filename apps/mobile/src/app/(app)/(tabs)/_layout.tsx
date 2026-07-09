/**
 * Tab-group layout — the NativeTabs UI, one level inside the protected group.
 * Nested under (app)'s Stack because NativeTabs renders ONLY its declared
 * triggers: full-screen non-tab routes like /demo-scan must live as Stack
 * siblings of the tab group, not as undeclared tab children (feature 003).
 * Route groups don't affect URLs, so /, /scan, /account are unchanged.
 */

import AppTabs from '@/components/app-tabs';

export default function TabsLayout() {
  return <AppTabs />;
}

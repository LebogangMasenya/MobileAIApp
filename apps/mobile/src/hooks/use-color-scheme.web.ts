import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Hydration detection without the setState-in-effect lint trap: the server
// snapshot is `false`, the client snapshot is `true`, and nothing ever
// changes after mount (the subscribe callback is a no-op). This gives the
// same "render 'light' during static rendering, real scheme after
// hydration" behavior as the useState+useEffect pattern, minus the extra
// cascading render the react-hooks rule flags.
const emptySubscribe = () => () => {};

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot: we are hydrated
    () => false, // server snapshot: static render, scheme unknown
  );
}

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useHasHydrated();
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}

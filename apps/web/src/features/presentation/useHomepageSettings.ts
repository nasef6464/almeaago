import { useEffect, useState } from 'react';
import { api } from './api';
import { sanitizeHomepageSettings } from './homepageSanitizer';
import type { HomepageSettings } from './homepage-types';

export const HOMEPAGE_SETTINGS_UPDATED = 'homepage-settings-updated';

// Legacy pages/Landing.tsx sanitizes saved Arabic before rendering. An admin
// save normally broadcasts a complete settings document, but consumers must
// also retain existing values when an event contains only changed fields.
// In particular, omitted hero/navigation sections must not erase the visitor
// page or throw while the initial GET is still pending.
function mergeHomepageEvent(
  previous: Partial<HomepageSettings>,
  patch: Partial<HomepageSettings>,
): HomepageSettings {
  return {
    ...previous,
    ...patch,
    hero: { ...(previous.hero || {}), ...(patch.hero || {}) },
    brand: { ...(previous.brand || {}), ...(patch.brand || {}) },
    sections: { ...(previous.sections || {}), ...(patch.sections || {}) },
    typography: { ...(previous.typography || {}), ...(patch.typography || {}) },
    navigation: { ...(previous.navigation || {}), ...(patch.navigation || {}) },
  } as HomepageSettings;
}

export function useHomepageSettings() {
  const [settings, setSettings] = useState<Partial<HomepageSettings>>({});

  useEffect(() => {
    let cancelled = false;
    // A same-tab admin save may arrive before the initial visitor GET resolves.
    // Keep the newer fields, but still hydrate unrelated saved fields from GET.
    let pendingPatch: Partial<HomepageSettings> = {};
    const receive = (event: Event) => {
      const patch = (event as CustomEvent<Partial<HomepageSettings> | null>).detail;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return;
      }

      pendingPatch = mergeHomepageEvent(pendingPatch, patch);
      setSettings((previous) =>
        sanitizeHomepageSettings(mergeHomepageEvent(previous, patch)),
      );
    };

    window.addEventListener(HOMEPAGE_SETTINGS_UPDATED, receive);
    api.getHomepageSettings()
      .then((value) => {
        if (!cancelled) {
          setSettings(sanitizeHomepageSettings(mergeHomepageEvent(value, pendingPatch)));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.removeEventListener(HOMEPAGE_SETTINGS_UPDATED, receive);
    };
  }, []);

  return settings;
}

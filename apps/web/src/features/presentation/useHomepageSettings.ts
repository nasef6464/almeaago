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
    let revision = 0;
    const receive = (event: Event) => {
      const patch = (event as CustomEvent<Partial<HomepageSettings> | null>).detail;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return;
      }

      revision++;
      setSettings((previous) =>
        sanitizeHomepageSettings(mergeHomepageEvent(previous, patch)),
      );
    };

    window.addEventListener(HOMEPAGE_SETTINGS_UPDATED, receive);
    const started = revision;
    api.getHomepageSettings()
      .then((value) => {
        if (!cancelled && started === revision) {
          setSettings(sanitizeHomepageSettings(value));
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

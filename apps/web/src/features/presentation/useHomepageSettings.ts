import { useEffect, useState } from 'react';
import { api } from './api';
import { sanitizeHomepageSettings } from './homepageSanitizer';
import type { HomepageSettings } from './homepage-types';

export const HOMEPAGE_SETTINGS_UPDATED = 'homepage-settings-updated';

// Legacy pages/Landing.tsx normalizes persisted Arabic homepage text before
// rendering. Apply the same normalization to both HTTP reads and save events,
// so a visitor never sees different text depending on the update path.
export function useHomepageSettings() {
  const [settings, setSettings] = useState<Partial<HomepageSettings>>({});

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const receive = (event: Event) => {
      revision++;
      setSettings(sanitizeHomepageSettings((event as CustomEvent<HomepageSettings>).detail));
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

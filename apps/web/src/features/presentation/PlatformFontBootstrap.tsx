import { useEffect } from 'react';
import { api } from './api';
import type { PlatformFontSettings } from './types';
import { applyPlatformFontSettings, DEFAULT_PLATFORM_FONT_SETTINGS } from './platformFonts';

export const PLATFORM_FONT_SETTINGS_UPDATED = 'platform-font-settings-updated';

export const PlatformFontBootstrap = () => {
    useEffect(() => {
        let cancelled = false;
        let revision = 0;

        applyPlatformFontSettings(DEFAULT_PLATFORM_FONT_SETTINGS);

        const loadFonts = async () => {
            const requestRevision = revision;
            if (requestRevision > 0) return;
            try {
                const response = await api.getPlatformFontSettings();
                if (!cancelled && revision === requestRevision) {
                    applyPlatformFontSettings(response as PlatformFontSettings);
                }
            } catch (error) {
                console.warn('Failed to load platform font settings', error);
                if (!cancelled && revision === requestRevision) {
                    applyPlatformFontSettings(DEFAULT_PLATFORM_FONT_SETTINGS);
                }
            }
        };

        const handleUpdate = (event: Event) => {
            revision += 1;
            const detail = (event as CustomEvent<PlatformFontSettings>).detail;
            applyPlatformFontSettings(detail);
        };

        window.addEventListener(PLATFORM_FONT_SETTINGS_UPDATED, handleUpdate);

        const requestIdle = window.requestIdleCallback?.bind(window);
        let idleHandle: number | undefined;
        let timer: number | undefined;

        if (requestIdle) {
            idleHandle = requestIdle(() => {
                void loadFonts();
            }, { timeout: 2500 });
        } else {
            timer = window.setTimeout(() => {
                void loadFonts();
            }, 1200);
        }

        return () => {
            cancelled = true;
            window.removeEventListener(PLATFORM_FONT_SETTINGS_UPDATED, handleUpdate);
            if (idleHandle !== undefined) {
                window.cancelIdleCallback?.(idleHandle);
            }
            if (timer !== undefined) {
                window.clearTimeout(timer);
            }
        };
    }, []);

    return null;
};

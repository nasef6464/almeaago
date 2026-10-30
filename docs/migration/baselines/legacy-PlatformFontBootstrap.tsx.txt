import { useEffect } from 'react';
import { api } from '../services/api';
import { PlatformFontSettings } from '../types';
import { applyPlatformFontSettings, DEFAULT_PLATFORM_FONT_SETTINGS } from '../utils/platformFonts';

export const PLATFORM_FONT_SETTINGS_UPDATED = 'platform-font-settings-updated';

export const PlatformFontBootstrap = () => {
    useEffect(() => {
        let cancelled = false;

        applyPlatformFontSettings(DEFAULT_PLATFORM_FONT_SETTINGS);

        const loadFonts = async () => {
            try {
                const response = await api.getPlatformFontSettings();
                if (!cancelled) {
                    applyPlatformFontSettings(response as PlatformFontSettings);
                }
            } catch (error) {
                console.warn('Failed to load platform font settings', error);
                if (!cancelled) {
                    applyPlatformFontSettings(DEFAULT_PLATFORM_FONT_SETTINGS);
                }
            }
        };

        const handleUpdate = (event: Event) => {
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

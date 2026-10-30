import {api as target} from '../../src/features/presentation/api';
import {authClient} from '../../src/features/auth/api/auth-client';
import type {PlatformFontSettings} from '../../src/features/presentation/types';
// Adapt only the legacy transport signature; both renderers use real Go data.
export const api={
 getPlatformFontSettings:target.getPlatformFontSettings,
 updatePlatformFontSettings:async(settings:PlatformFontSettings)=>target.updatePlatformFontSettings(settings,(await authClient.csrf()).csrfToken),
};

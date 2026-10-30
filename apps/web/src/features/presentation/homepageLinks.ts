export function homepageHref(value:string|undefined,fallback:string){const raw=value?.trim()||fallback;return /^(https?:\/\/|\/(?!\/)|#)/i.test(raw)?raw:fallback;}

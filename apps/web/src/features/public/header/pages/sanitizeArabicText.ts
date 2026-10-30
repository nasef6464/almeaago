const WINDOWS_1252_BYTE_MAP: Record<string, number> = {
    'â‚¬': 0x80,
    'â€š': 0x82,
    'Æ’': 0x83,
    'â€ž': 0x84,
    'â€¦': 0x85,
    'â€ ': 0x86,
    'â€¡': 0x87,
    'Ë†': 0x88,
    'â€°': 0x89,
    'Å ': 0x8a,
    'â€¹': 0x8b,
    'Å’': 0x8c,
    'Å½': 0x8e,
    'â€˜': 0x91,
    'â€™': 0x92,
    'â€œ': 0x93,
    'â€': 0x94,
    'â€¢': 0x95,
    'â€“': 0x96,
    'â€”': 0x97,
    'Ëœ': 0x98,
    'â„¢': 0x99,
    'Å¡': 0x9a,
    'â€º': 0x9b,
    'Å“': 0x9c,
    'Å¾': 0x9e,
    'Å¸': 0x9f,
};

const decodeMojibakeUtf8 = (value: string): string => {
    try {
        const bytes = Uint8Array.from(
            Array.from(value).map((char) => {
                const code = char.charCodeAt(0);
                return code <= 0xff ? code : WINDOWS_1252_BYTE_MAP[char] ?? code;
            }),
        );
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return value;
    }
};

export const sanitizeArabicText = (value?: string | null): string => {
    if (!value) {
        return '';
    }

    if (!/[ÃØÙ]/.test(value)) {
        return value;
    }

    const decoded = decodeMojibakeUtf8(value);
    if (decoded && /[\u0600-\u06FF]/.test(decoded)) {
        return decoded;
    }

    return value;
};

import katex from 'katex';

/**
 * Basic HTML entity decoder
 */
export function decodeHtmlEntities(value: string): string {
  if (!value) return '';
  let output = value;
  for (let i = 0; i < 2; i += 1) {
    output = output
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&');
  }
  return output;
}

/**
 * Cleans potentially dangerous HTML tags and script injection
 */
export function sanitizeHtml(value: string): string {
  if (!value) return '';
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/<\s*(script|style|object|embed|link|meta|base)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s(?:on[a-z]+|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html|vbscript:)[\s\S]*?\1/gi, '')
    .replace(/\s(?:href|src|xlink:href)\s*=\s*(?:javascript:|data:text\/html|vbscript:)[^\s>]*/gi, '')
    .replace(/\sstyle\s*=\s*(["'])[\s\S]*?(?:expression\s*\(|javascript:|vbscript:|data:text\/html)[\s\S]*?\1/gi, '')
    .trim();
}

/**
 * Parses LaTeX math markers ($...$, $$...$$, \(...\), \[...\]) and renders with KaTeX
 */
export function renderMathInText(rawText: string): string {
  if (!rawText) return '';

  // 1. Display math: $$...$$
  let result = rawText.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="katex-display-wrapper my-2 overflow-x-auto text-center" dir="ltr">${rendered}</div>`;
    } catch {
      return math;
    }
  });

  // 2. Display math: \[...\]
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="katex-display-wrapper my-2 overflow-x-auto text-center" dir="ltr">${rendered}</div>`;
    } catch {
      return math;
    }
  });

  // 3. Inline math: $...$
  result = result.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="katex-inline-wrapper mx-0.5 inline-block align-middle" dir="ltr">${rendered}</span>`;
    } catch {
      return math;
    }
  });

  // 4. Inline math: \(...\)
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="katex-inline-wrapper mx-0.5 inline-block align-middle" dir="ltr">${rendered}</span>`;
    } catch {
      return math;
    }
  });

  return result;
}

const QUESTION_BLANK_PATTERN = /(?:\.{3,}|…{2,}|_{3,}|ـ{3,})/g;

/**
 * Normalizes question text / option for safe rendering with rich KaTeX math support
 */
export function normalizeQuestionHtml(value?: string | null): string {
  if (!value) return '';
  const decoded = decodeHtmlEntities(value);
  const sanitized = sanitizeHtml(decoded);
  const withMath = renderMathInText(sanitized);

  // Format verbal blanks nicely
  return withMath.replace(
    QUESTION_BLANK_PATTERN,
    '<span class="question-blank font-mono tracking-widest text-indigo-600 font-bold" dir="ltr">......</span>',
  );
}


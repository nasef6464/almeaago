import { useEffect, useState } from 'react';

type AssetResponse = {
  asset?: { id: string; publicUrl: string; status: string; mimeType: string };
};
type ImageState = {
  assetId: string;
  url: string;
  loading: boolean;
  error: boolean;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function safeImageURL(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Resolve an existing QuestionBank media reference through the authenticated Go
 * media API. Only active image assets may be displayed. The question/option
 * identity stays in QuestionBank; no image bytes or duplicate URLs are stored.
 */
export function QuestionAssetImage({
  assetId,
  alt,
  className = '',
}: {
  assetId: string;
  alt: string;
  className?: string;
}) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<ImageState | null>(null);

  useEffect(() => {
    if (!assetId) {
      setState(null);
      return;
    }
    if (assetId.startsWith('data:') || assetId.startsWith('http://') || assetId.startsWith('https://')) {
      setState({ assetId, url: assetId, loading: false, error: false });
      return;
    }
    const controller = new AbortController();
    setState({ assetId, url: '', loading: true, error: false });
    fetch(`${API_BASE}/api/v1/media/assets/${encodeURIComponent(assetId)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Media lookup failed');
        const payload = (await response.json()) as AssetResponse;
        const asset = payload.asset;
        const url = safeImageURL(asset?.publicUrl ?? '');
        if (asset?.id !== assetId || asset.status !== 'active' || !asset.mimeType?.startsWith('image/') || !url) {
          throw new Error('Media is not an active image');
        }
        if (!controller.signal.aborted) setState({ assetId, url, loading: false, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ assetId, url: '', loading: false, error: true });
      });
    return () => controller.abort();
  }, [assetId, retry]);

  if (!assetId) return null;
  const current = state?.assetId === assetId ? state : null;

  if (!current || current.loading) {
    return <span role="status" className="block rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">جاري تحميل الصورة...</span>;
  }

  if (current.error) {
    return (
      <span className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-800">
        <span className="block">تعذر تحميل {alt}</span>
        <button type="button" className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1" onClick={() => setRetry(value => value + 1)}>
          إعادة تحميل الصورة
        </button>
      </span>
    );
  }

  return (
    <img
      src={current.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className || 'mx-auto max-h-[340px] max-w-full rounded-xl object-contain'}
      onError={() => setState({ assetId, url: '', loading: false, error: true })}
    />
  );
}

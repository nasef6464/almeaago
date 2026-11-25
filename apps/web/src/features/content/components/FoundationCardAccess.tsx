import { useState } from 'react';
import { contentClient } from '../api/content-client';
import type { FoundationTopicSummary } from '../api/content-types';

interface Props {
  topic: FoundationTopicSummary;
  getCsrfToken: () => Promise<string>;
  onUpdated: (topic: FoundationTopicSummary) => void;
}

export function FoundationCardAccess({ topic, getCsrfToken, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = topic.isLocked ? 'مجاني' : 'ضمن باقة';
  const label = topic.isLocked
    ? `جعل ${topic.title} مجانيًا`
    : `جعل ${topic.title} ضمن باقة التأسيس`;

  async function toggleAccess() {
    setBusy(true);
    setError('');
    try {
      const { topic: current } = await contentClient.foundationTopic(topic.id);
      if (current.revision !== topic.revision) {
        onUpdated(current);
        setError('تغيّر الموضوع. راجع حالته ثم أعد المحاولة.');
        return;
      }
      const { pathId, subjectId, parentTopicId, code, title, description, sortOrder, status, isVisible, skillIds, revision } = current;
      const { topic: updated } = await contentClient.updateFoundationTopic(topic.id, {
        pathId, subjectId, parentTopicId, code, title, description, sortOrder, status,
        isVisible, skillIds, isLocked: !current.isLocked, expectedRevision: revision,
      }, await getCsrfToken());
      onUpdated(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تغيير إتاحة الموضوع.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={busy}
        onClick={() => void toggleAccess()}
        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {busy ? 'جارٍ الحفظ…' : action}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

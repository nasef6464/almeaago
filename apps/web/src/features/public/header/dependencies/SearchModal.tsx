import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { createSearchClient, createSearchSession, type SearchType, type SearchPayload } from './search-transport';
const searchClient = createSearchClient(import.meta.env.VITE_API_BASE_URL ?? '');

export const SearchModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [error, setError] = useState('');
  const session = useMemo(() => createSearchSession(searchClient, (state) => {
    setLoading(state.loading);
    setPayload(state.payload);
    setError(state.error);
  }), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    session.cancel();
    if (!open || query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      void session.search(query.trim(), searchType);
    }, 220);
    return () => {
      window.clearTimeout(timer);
      session.cancel(false);
    };
  }, [open, query, searchType, session]);

  const hasResults = useMemo(() => {
    if (!payload) return false;
    return payload.results.courses.length + payload.results.lessons.length + payload.results.questions.length > 0;
  }, [payload]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 p-4 flex items-start justify-center" onClick={onClose}>
      <div className="mt-16 w-full max-w-3xl rounded-2xl border border-gray-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <Search size={18} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
            placeholder="ابحث عن درس أو سؤال أو دورة..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
            aria-label="Search type"
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="all">الكل</option>
            <option value="course">الدورات</option>
            <option value="lesson">الدروس</option>
            <option value="question">الأسئلة</option>
          </select>
          <button aria-label="Close search" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto p-4 space-y-4">
          {error ? <div role="alert" className="text-sm text-red-600">{error}</div> : null}
          {loading ? <div className="text-sm text-gray-500">جاري البحث...</div> : null}
          {!loading && query.trim().length < 2 ? <div className="text-sm text-gray-500">اكتب حرفين على الأقل.</div> : null}
          {!loading && !error && query.trim().length >= 2 && !hasResults ? <div className="text-sm text-gray-500">لا توجد نتائج مطابقة الآن.</div> : null}

          {payload?.results.courses.length ? (
            <section>
              <h4 className="mb-2 text-xs font-black text-amber-700">الدورات</h4>
              <div className="space-y-2">
                {payload.results.courses.map((row) => (
                  <Link key={`c-${row.id}`} to={row.route} onClick={onClose} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <div className="font-bold text-sm text-gray-900">{row.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{row.subtitle}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {payload?.results.lessons.length ? (
            <section>
              <h4 className="mb-2 text-xs font-black text-indigo-700">الدروس</h4>
              <div className="space-y-2">
                {payload.results.lessons.map((row) => (
                  <Link key={`l-${row.id}`} to={row.route} onClick={onClose} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <div className="font-bold text-sm text-gray-900">{row.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{row.subtitle}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {payload?.results.questions.length ? (
            <section>
              <h4 className="mb-2 text-xs font-black text-emerald-700">الأسئلة</h4>
              <div className="space-y-2">
                {payload.results.questions.map((row) => (
                  <Link key={`q-${row.id}`} to={row.route} onClick={onClose} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <div className="font-bold text-sm text-gray-900">{row.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{row.subtitle}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

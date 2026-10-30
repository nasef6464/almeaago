import React, { useState, useMemo } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import {
  EDUCATIONAL_ICONS,
  ICON_CATEGORIES,
  type EducationalIconCategory,
  resolveIconComponent,
} from '../../public/header/pages/educationalIcons';
import { resolveColor } from './pathDisplayPresentation';

interface EducationalIconPickerProps {
  selectedIcon: string;
  selectedIconUrl?: string;
  color?: string;
  onSelectIcon: (icon: string) => void;
  onUploadIconUrl?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearIconUrl?: () => void;
  defaultFallback?: string;
  label?: string;
}

export const EducationalIconPicker: React.FC<EducationalIconPickerProps> = ({
  selectedIcon,
  selectedIconUrl,
  color,
  onSelectIcon,
  onUploadIconUrl,
  onClearIconUrl,
  defaultFallback = '📚',
  label = 'أيقونة العنصر التعليمي',
}) => {
  const [activeCategory, setActiveCategory] = useState<EducationalIconCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const resolvedColor = resolveColor(color);

  const filteredIcons = useMemo(() => {
    return EDUCATIONAL_ICONS.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const q = searchQuery.trim().toLowerCase();
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchKeywords = item.keywords.some((kw) => kw.toLowerCase().includes(q));
      const matchLucide = item.lucideName?.toLowerCase().includes(q);
      return matchLabel || matchKeywords || matchLucide;
    });
  }, [activeCategory, searchQuery]);

  const activeIconItem = useMemo(() => {
    return EDUCATIONAL_ICONS.find((item) => item.id === selectedIcon);
  }, [selectedIcon]);

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 transition-all" dir="rtl">
      {/* Header & Live Preview */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <label className="block text-sm font-black text-gray-800">{label}</label>
          <span className="text-xs text-gray-500">اختر من الأيقونات المناسبة للمواد أو أدخل رمزاً مخصصاً</span>
        </div>

        {/* Live Badge Preview */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">معاينة الأيقونة:</span>
          <div
            className="flex h-11 min-w-[50px] items-center justify-center gap-1.5 rounded-xl px-3 shadow-xs border transition-all"
            style={{
              backgroundColor: resolvedColor.soft,
              borderColor: resolvedColor.border,
              color: resolvedColor.text,
            }}
            title="معاينة مظهر الأيقونة في الأزرار والبطاقات"
          >
            {selectedIconUrl ? (
              <img src={selectedIconUrl} alt="icon preview" className="h-6 w-6 object-contain" />
            ) : (
              resolveIconComponent(selectedIcon, 'w-6 h-6', defaultFallback)
            )}
            <span className="text-xs font-black">
              {selectedIconUrl ? 'صورة مرفوعة' : (activeIconItem?.label || 'المعاينة')}
            </span>
          </div>
        </div>
      </div>

      {/* Upload & Direct Input Controls */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={selectedIcon}
            onChange={(e) => onSelectIcon(e.target.value)}
            placeholder="رمز إيموجي أو اسم أيقونة (مثال: 📚 أو lucide:Book)"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 placeholder-gray-400 shadow-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        {onUploadIconUrl && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={onUploadIconUrl}
              className="text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {selectedIconUrl && onClearIconUrl && (
              <button
                type="button"
                onClick={onClearIconUrl}
                className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                title="حذف الصورة المرفوعة"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toggle Expand Icon Library Button */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-black text-indigo-700 shadow-xs hover:bg-indigo-50 transition-colors"
        >
          <Sparkles size={14} />
          <span>{isExpanded ? 'إخفاء مكتبة الأيقونات التعليمية' : 'تصفح مكتبة الأيقونات التعليمية (+80 أيقونة)'}</span>
        </button>
      </div>

      {/* Expanded Icon Library */}
      {isExpanded && (
        <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3 shadow-inner">
          {/* Categories Tab Strip */}
          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-2">
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الأيقونات..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-1.5 pl-3 pr-8 text-xs font-bold focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Icons Grid */}
          <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto p-1 sm:grid-cols-6 md:grid-cols-8">
            {filteredIcons.map((item) => {
              const isSelected = selectedIcon === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectIcon(item.id)}
                  title={item.label}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-center transition-all ${
                    isSelected
                      ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border border-gray-100 bg-gray-50/60 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex h-6 w-6 items-center justify-center">
                    {resolveIconComponent(item.id, 'w-5 h-5')}
                  </div>
                  <span className="w-full truncate text-[10px] font-bold text-gray-500">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

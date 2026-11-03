import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, X, Move } from 'lucide-react';

export interface QuestionImageZoomModalProps {
  imageUrl: string | null;
  onClose: () => void;
  altText?: string;
}

export const QuestionImageZoomModal: React.FC<QuestionImageZoomModalProps> = ({
  imageUrl,
  onClose,
  altText = 'صورة السؤال',
}) => {
  const [scale, setScale] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialPosX: 0, initialPosY: 0 });

  // Reset transform when new image opens
  useEffect(() => {
    if (imageUrl) {
      setScale(1.0);
      setPosition({ x: 0, y: 0 });
    }
  }, [imageUrl]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!imageUrl) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [imageUrl]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 3.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(Math.round((prev - 0.25) * 100) / 100, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMaximize = useCallback(() => {
    setScale(2.25);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => (prev > 1.2 ? 1.0 : 2.0));
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => Math.min(Math.max(Math.round((prev + delta) * 100) / 100, 0.5), 3.5));
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.initialPosX + deltaX,
      y: dragStartRef.current.initialPosY + deltaY,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        initialPosX: position.x,
        initialPosY: position.y,
      };
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.initialPosX + deltaX,
      y: dragStartRef.current.initialPosY + deltaY,
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!imageUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl, onClose, handleZoomIn, handleZoomOut, handleReset]);

  if (!imageUrl) return null;

  const zoomPercentage = Math.round(scale * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تكبير صورة السؤال"
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-slate-950/90 p-3 sm:p-6 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Top Header Toolbar */}
      <div
        className="flex items-center justify-between z-20 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-bold text-slate-300 border border-slate-700/60 backdrop-blur-sm">
            <Move size={13} className="text-indigo-400" />
            <span>اسحب بالماوس لتحريك الرسم</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs sm:text-sm font-black text-slate-900 shadow-xl hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/40"
          title="إغلاق (Esc)"
        >
          <X size={16} className="text-rose-600" />
          <span>إغلاق</span>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-bold">(Esc)</span>
        </button>
      </div>

      {/* Main Canvas Viewport */}
      <div
        className={`flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 ${
          isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className="transition-transform duration-100 ease-out will-change-transform inline-block max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl bg-white p-2.5 sm:p-4 shadow-2xl border border-slate-700/40 ring-1 ring-white/20">
            <img
              src={imageUrl}
              alt={altText}
              className="max-h-[65vh] sm:max-h-[72vh] md:max-h-[76vh] w-auto max-w-[90vw] object-contain rounded-xl select-none"
              style={{
                minWidth: 'min(100%, 380px)',
                imageRendering: 'auto',
              }}
              draggable={false}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Floating Bottom Control Pill Bar */}
      <div
        className="flex flex-col items-center gap-2 z-20 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-slate-900/90 px-4 py-2 border border-slate-700/80 shadow-2xl backdrop-blur-md text-white">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:scale-105 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
            title="تصغير (-)"
          >
            <ZoomOut size={16} />
          </button>

          {/* Current Zoom Percentage Pill (Clickable to Reset) */}
          <button
            type="button"
            onClick={handleReset}
            className="min-w-[62px] px-2.5 py-1 rounded-full bg-indigo-600/30 border border-indigo-500/40 font-black text-xs sm:text-sm text-indigo-300 hover:bg-indigo-600/50 hover:text-white transition-all cursor-pointer"
            title="انقر لإعادة الضبط لـ 100%"
          >
            {zoomPercentage}%
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.5}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 disabled:opacity-40 shadow-md shadow-indigo-500/30 transition-all cursor-pointer"
            title="تكبير (+)"
          >
            <ZoomIn size={16} />
          </button>

          <div className="h-5 w-px bg-slate-700/80 mx-0.5" />

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-black transition-all cursor-pointer"
            title="الحجم الأصلي (0)"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">إعادة ضبط</span>
          </button>

          {/* Maximize / 2x Button */}
          <button
            type="button"
            onClick={handleMaximize}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-black transition-all cursor-pointer"
            title="أقصى تكبير"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">تكبير كامل</span>
          </button>
        </div>

        <p className="text-[11px] font-bold text-slate-400 text-center drop-shadow-sm">
          💡 انقر نقراً مزدوجاً على الصورة للتبديل السريع بين التكبير والعادي • تدوير عجلة الفأرة يكبّر ويصغّر فوراً
        </p>
      </div>
    </div>
  );
};

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type {
  WhiteboardTool,
  WhiteboardTheme,
  WhiteboardElement,
  WhiteboardPoint,
} from '../../api/classroom-types';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { MathFormulaModal } from './MathFormulaModal';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { xapi } from '../../api/classroom-xapi';

interface SmartWhiteboardCanvasProps {
  sessionId?: string;
  isReadOnly?: boolean;
  onSyncState?: (elements: WhiteboardElement[], theme: WhiteboardTheme) => void;
  initialElements?: WhiteboardElement[];
  initialTheme?: WhiteboardTheme;
}

export const SmartWhiteboardCanvas: React.FC<SmartWhiteboardCanvasProps> = ({
  sessionId = 'demo',
  isReadOnly = false,
  onSyncState,
  initialElements = [],
  initialTheme = 'math_grid',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [elements, setElements] = useState<WhiteboardElement[]>(initialElements);
  const [history, setHistory] = useState<WhiteboardElement[][]>([initialElements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [currentTool, setCurrentTool] = useState<WhiteboardTool>('pen');
  const [currentColor, setCurrentColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [theme, setTheme] = useState<WhiteboardTheme>(initialTheme);
  const [isBroadcast, setIsBroadcast] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [mathFormulas, setMathFormulas] = useState<
    Array<{ id: string; latex: string; x: number; y: number }>
  >([]);

  // Update from external props if provided
  useEffect(() => {
    if (initialElements.length > 0 && elements.length === 0) {
      setElements(initialElements);
    }
  }, [initialElements]);

  // Synchronize state outwards
  const notifyChange = useCallback(
    (newElements: WhiteboardElement[], currentTheme: WhiteboardTheme) => {
      if (onSyncState) {
        onSyncState(newElements, currentTheme);
      }
      try {
        sessionStorage.setItem(
          `almeaa:whiteboard:${sessionId}`,
          JSON.stringify({ elements: newElements, theme: currentTheme })
        );
      } catch {}
    },
    [onSyncState, sessionId]
  );

  // Resize canvas to fill container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        redrawAll();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme, elements, currentElement]);

  // Redraw all canvas items
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = parseFloat(canvas.style.width || String(canvas.width));
    const height = parseFloat(canvas.style.height || String(canvas.height));

    ctx.clearRect(0, 0, width, height);

    // Draw Background
    drawBackground(ctx, width, height, theme);

    // Draw saved elements
    elements.forEach((el) => drawElement(ctx, el));

    // Draw currently drawing element
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  }, [elements, currentElement, theme]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  // Background drawing helper
  const drawBackground = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    currentTheme: WhiteboardTheme
  ) => {
    if (currentTheme === 'dark_chalkboard') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Chalkboard fine dust grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const step = 30;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      return;
    }

    if (currentTheme === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    if (currentTheme === 'math_grid') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      return;
    }

    if (currentTheme === 'lined') {
      ctx.fillStyle = '#fefefe';
      ctx.fillRect(0, 0, w, h);

      // Red margin line
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w - 60, 0);
      ctx.lineTo(w - 60, h);
      ctx.stroke();

      // Horizontal lines
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      const step = 32;
      for (let y = 40; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
  };

  // Helper to draw single element
  const drawElement = (ctx: CanvasRenderingContext2D, el: WhiteboardElement) => {
    ctx.save();

    if (el.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.strokeWidth * 3;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
    } else if (el.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = el.strokeWidth * 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Freehand Pen / Highlighter / Eraser
    if ((el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') && el.points && el.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        const xc = (el.points[i - 1].x + el.points[i].x) / 2;
        const yc = (el.points[i - 1].y + el.points[i].y) / 2;
        ctx.quadraticCurveTo(el.points[i - 1].x, el.points[i - 1].y, xc, yc);
      }
      ctx.stroke();
    }

    // Straight Line
    if (el.tool === 'line' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      ctx.beginPath();
      ctx.moveTo(el.startX, el.startY);
      ctx.lineTo(el.endX, el.endY);
      ctx.stroke();
    }

    // Arrow
    if (el.tool === 'arrow' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      const headlen = 15;
      const angle = Math.atan2(el.endY - el.startY, el.endX - el.startX);
      ctx.beginPath();
      ctx.moveTo(el.startX, el.startY);
      ctx.lineTo(el.endX, el.endY);
      ctx.lineTo(
        el.endX - headlen * Math.cos(angle - Math.PI / 6),
        el.endY - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(el.endX, el.endY);
      ctx.lineTo(
        el.endX - headlen * Math.cos(angle + Math.PI / 6),
        el.endY - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }

    // Rectangle
    if (el.tool === 'rectangle' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      const x = Math.min(el.startX, el.endX);
      const y = Math.min(el.startY, el.endY);
      const w = Math.abs(el.endX - el.startX);
      const h = Math.abs(el.endY - el.startY);
      ctx.beginPath();
      ctx.strokeRect(x, y, w, h);
    }

    // Circle / Ellipse
    if (el.tool === 'circle' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      const radiusX = Math.abs(el.endX - el.startX) / 2;
      const radiusY = Math.abs(el.endY - el.startY) / 2;
      const centerX = Math.min(el.startX, el.endX) + radiusX;
      const centerY = Math.min(el.startY, el.endY) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Triangle
    if (el.tool === 'triangle' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      ctx.beginPath();
      ctx.moveTo((el.startX + el.endX) / 2, el.startY);
      ctx.lineTo(el.startX, el.endY);
      ctx.lineTo(el.endX, el.endY);
      ctx.closePath();
      ctx.stroke();
    }

    // Cartesian Coordinate Plane
    if (el.tool === 'coordinate_plane' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
      const minX = Math.min(el.startX, el.endX);
      const maxX = Math.max(el.startX, el.endX);
      const minY = Math.min(el.startY, el.endY);
      const maxY = Math.max(el.startY, el.endY);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      ctx.beginPath();
      // X-Axis
      ctx.moveTo(minX, midY);
      ctx.lineTo(maxX, midY);
      // X arrow head
      ctx.lineTo(maxX - 8, midY - 5);
      ctx.moveTo(maxX, midY);
      ctx.lineTo(maxX - 8, midY + 5);

      // Y-Axis
      ctx.moveTo(midX, maxY);
      ctx.lineTo(midX, minY);
      // Y arrow head
      ctx.lineTo(midX - 5, minY + 8);
      ctx.moveTo(midX, minY);
      ctx.lineTo(midX + 5, minY + 8);
      ctx.stroke();

      // Tick marks
      const tickStep = 20;
      for (let x = midX + tickStep; x < maxX - 10; x += tickStep) {
        ctx.beginPath();
        ctx.moveTo(x, midY - 4);
        ctx.lineTo(x, midY + 4);
        ctx.stroke();
      }
      for (let x = midX - tickStep; x > minX + 10; x -= tickStep) {
        ctx.beginPath();
        ctx.moveTo(x, midY - 4);
        ctx.lineTo(x, midY + 4);
        ctx.stroke();
      }
      for (let y = midY + tickStep; y < maxY - 10; y += tickStep) {
        ctx.beginPath();
        ctx.moveTo(midX - 4, y);
        ctx.lineTo(midX + 4, y);
        ctx.stroke();
      }
      for (let y = midY - tickStep; y > minY + 10; y -= tickStep) {
        ctx.beginPath();
        ctx.moveTo(midX - 4, y);
        ctx.lineTo(midX + 4, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Mouse / Touch Handlers
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent): WhiteboardPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const mouseEvent = e as React.MouseEvent;
    return {
      x: mouseEvent.clientX - rect.left,
      y: mouseEvent.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;
    const pt = getCanvasCoordinates(e);
    setIsDrawing(true);

    if (currentTool === 'text') {
      const text = window.prompt('اكتب الملاحظة النصية:');
      if (text && text.trim()) {
        const textElement: WhiteboardElement = {
          id: `el-${Date.now()}`,
          tool: 'text',
          color: currentColor,
          strokeWidth,
          startX: pt.x,
          startY: pt.y,
          text: text.trim(),
        };
        const nextElements = [...elements, textElement];
        updateHistory(nextElements);
      }
      setIsDrawing(false);
      return;
    }

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      setCurrentElement({
        id: `el-${Date.now()}`,
        tool: currentTool,
        color: currentColor,
        strokeWidth,
        points: [pt],
      });
    } else {
      setCurrentElement({
        id: `el-${Date.now()}`,
        tool: currentTool,
        color: currentColor,
        strokeWidth,
        startX: pt.x,
        startY: pt.y,
        endX: pt.x,
        endY: pt.y,
      });
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentElement) return;
    const pt = getCanvasCoordinates(e);

    if (
      currentElement.tool === 'pen' ||
      currentElement.tool === 'highlighter' ||
      currentElement.tool === 'eraser'
    ) {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), pt],
            }
          : null
      );
    } else {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              endX: pt.x,
              endY: pt.y,
            }
          : null
      );
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    const nextElements = [...elements, currentElement];
    setCurrentElement(null);
    updateHistory(nextElements);

    // Record xAPI interaction
    xapi.recordWhiteboardInteraction(sessionId, 'المعلم', `رسم أداة ${currentElement.tool}`);
  };

  const updateHistory = (newElements: WhiteboardElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
    notifyChange(newElements, theme);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setElements(history[nextIdx]);
      notifyChange(history[nextIdx], theme);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setElements(history[nextIdx]);
      notifyChange(history[nextIdx], theme);
    }
  };

  const handleClear = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع عناصر السبورة الذكية؟')) {
      updateHistory([]);
      setMathFormulas([]);
    }
  };

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `whiteboard-${sessionId}-${Date.now()}.png`;
    a.click();
  };

  const handleInsertFormula = (latex: string) => {
    const id = `formula-${Date.now()}`;
    const newFormulas = [...mathFormulas, { id, latex, x: 80, y: 120 }];
    setMathFormulas(newFormulas);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 shadow-xl transition-colors dark:border-slate-800 ${
        theme === 'dark_chalkboard' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Floating Toolbar (Only for Teacher / Non-readonly) */}
      {!isReadOnly && (
        <div className="absolute top-3 left-3 right-3 z-30">
          <WhiteboardToolbar
            currentTool={currentTool}
            onSelectTool={setCurrentTool}
            currentColor={currentColor}
            onSelectColor={setCurrentColor}
            strokeWidth={strokeWidth}
            onSelectStrokeWidth={setStrokeWidth}
            theme={theme}
            onSelectTheme={(t) => {
              setTheme(t);
              notifyChange(elements, t);
            }}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onExport={handleExportPng}
            onOpenFormulaModal={() => setFormulaModalOpen(true)}
            isBroadcastActive={isBroadcast}
            onToggleBroadcast={() => setIsBroadcast((prev) => !prev)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      )}

      {/* Main Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        className={`h-full w-full touch-none select-none ${isReadOnly ? 'cursor-default' : 'cursor-crosshair'}`}
      />

      {/* Embedded KaTeX Mathematical Formulas Overlay */}
      {mathFormulas.map((item) => {
        let html = '';
        try {
          html = katex.renderToString(item.latex, { displayMode: true });
        } catch {
          html = item.latex;
        }

        return (
          <div
            key={item.id}
            style={{ left: `${item.x}px`, top: `${item.y}px` }}
            className="absolute z-20 flex cursor-move items-center gap-2 rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-indigo-900 dark:bg-slate-900/95"
          >
            <div
              dir="ltr"
              className="text-xl text-slate-900 dark:text-slate-100"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setMathFormulas((prev) => prev.filter((f) => f.id !== item.id))}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* KaTeX Insert Modal */}
      <MathFormulaModal
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        onInsert={handleInsertFormula}
      />
    </div>
  );
};

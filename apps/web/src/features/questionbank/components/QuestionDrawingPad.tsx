import React, { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Eraser,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  TextCursorInput,
  TriangleRight,
  X,
} from 'lucide-react';

export type DrawingMode = 'freehand' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'angle' | 'text';

interface Point {
  x: number;
  y: number;
}

export interface QuestionDrawingPadProps {
  onInsertImage: (dataUrl: string) => void;
  onClose?: () => void;
}

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 360;

const modes: Array<{ id: DrawingMode; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'freehand', label: 'رسم حر', Icon: Pencil },
  { id: 'line', label: 'خط مستقيم', Icon: Minus },
  { id: 'arrow', label: 'سهم', Icon: MousePointer2 },
  { id: 'rectangle', label: 'مستطيل / مربع', Icon: Square },
  { id: 'circle', label: 'دائرة', Icon: Circle },
  { id: 'angle', label: 'زاوية هندسية', Icon: TriangleRight },
  { id: 'text', label: 'رمز / كتابة', Icon: TextCursorInput },
];

const getCanvasPoint = (canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>): Point => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
};

const prepareCanvas = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#0f172a';
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.font = '700 28px Arial, Tahoma, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
};

const drawArrowHead = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = 18;

  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
};

export const QuestionDrawingPad: React.FC<QuestionDrawingPadProps> = ({ onInsertImage, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const [mode, setMode] = useState<DrawingMode>('line');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textLabel, setTextLabel] = useState('س');
  const [strokeColor, setStrokeColor] = useState('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareCanvas(canvas);
  }, []);

  const drawShape = (point: Point) => {
    const canvas = canvasRef.current;
    const start = startPoint;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !start || !snapshotRef.current) return;

    context.putImageData(snapshotRef.current, 0, 0);
    context.strokeStyle = strokeColor;
    context.fillStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.beginPath();

    if (mode === 'line' || mode === 'arrow') {
      context.moveTo(start.x, start.y);
      context.lineTo(point.x, point.y);
      if (mode === 'arrow') {
        drawArrowHead(context, start, point);
      }
    }

    if (mode === 'rectangle') {
      context.rect(start.x, start.y, point.x - start.x, point.y - start.y);
    }

    if (mode === 'circle') {
      const radius = Math.hypot(point.x - start.x, point.y - start.y);
      context.arc(start.x, start.y, radius, 0, Math.PI * 2);
    }

    if (mode === 'angle') {
      context.moveTo(start.x, start.y);
      context.lineTo(point.x, point.y);
      context.moveTo(start.x, start.y);
      context.lineTo(start.x + Math.abs(point.x - start.x), start.y);
    }

    context.stroke();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const point = getCanvasPoint(canvas, event);
    context.strokeStyle = strokeColor;
    context.fillStyle = strokeColor;
    context.lineWidth = strokeWidth;

    if (mode === 'text') {
      const label = textLabel.trim() || 'س';
      context.font = '700 28px Arial, Tahoma, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, point.x, point.y);
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);
    snapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);

    if (mode === 'freehand') {
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const point = getCanvasPoint(canvas, event);
    if (mode === 'freehand') {
      context.lineTo(point.x, point.y);
      context.stroke();
      return;
    }

    drawShape(point);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    setIsDrawing(false);
    setStartPoint(null);
    snapshotRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareCanvas(canvas);
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onInsertImage(canvas.toDataURL('image/png'));
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm"
      data-testid="question-editor-drawing-pad"
      dir="rtl"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs">
            📐
          </span>
          <div>
            <h4 className="text-sm font-black text-slate-900">محرر رسم الأشكال الهندسية والكمي</h4>
            <p className="text-[11px] font-bold text-slate-500">ارسم المسألة الهندسية وأضف الرموز ثم أدرجها مباشرة كصورة للسؤال</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
            title="إغلاق لوحة الرسم"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {modes.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-black transition ${
                mode === id
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={label}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">
            <span>اللون:</span>
            <input
              type="color"
              value={strokeColor}
              onChange={(event) => setStrokeColor(event.target.value)}
              className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="لون الرسم"
            />
          </label>

          <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">
            <span>السُّمك:</span>
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="text-xs font-black bg-transparent border-0 outline-none cursor-pointer"
            >
              <option value="2">رفيع (2px)</option>
              <option value="4">متوسط (4px)</option>
              <option value="6">عريض (6px)</option>
            </select>
          </label>

          {mode === 'text' && (
            <input
              value={textLabel}
              onChange={(event) => setTextLabel(event.target.value)}
              maxLength={16}
              className="h-8 w-24 rounded-xl border border-indigo-300 bg-white px-2 text-center text-xs font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="س، ص، 90°"
              aria-label="نص الرمز الرياضي"
            />
          )}

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
            title="مسح الكانفاس بالكامل"
          >
            <Eraser className="h-3.5 w-3.5" />
            مسح
          </button>

          <button
            type="button"
            onClick={handleInsert}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
            data-testid="question-editor-insert-drawing"
          >
            <ImagePlus className="h-4 w-4" />
            إدراج كصورة للسؤال
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block aspect-[2/1] w-full touch-none cursor-crosshair bg-white"
          data-testid="question-editor-drawing-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-slate-500">
        <MousePointer2 className="h-3.5 w-3.5 text-indigo-500" />
        <span>طريقة الاستخدام: اختر الخط أو الدائرة أو الزاوية واسحب على اللوحة. لإضافة رمز (مثل س أو 60°)، اختر كتابة ثم اضغط مكان الرمز.</span>
      </div>
    </div>
  );
};


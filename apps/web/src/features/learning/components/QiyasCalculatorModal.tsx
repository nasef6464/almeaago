import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Target, Award } from 'lucide-react';

interface QiyasCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultQudratScore?: number;
}

const UNIVERSITIES = [
  { id: 'standard_sci', name: 'المسار العلمي (أغلب الجامعات)', hs: 40, qudrat: 30, tahsili: 30 },
  { id: 'standard_arts', name: 'المسار الإنساني (أغلب الجامعات)', hs: 50, qudrat: 50, tahsili: 0 },
  { id: 'kfupm', name: 'جامعة البترول والمعادن (KFUPM)', hs: 10, qudrat: 40, tahsili: 50 },
  { id: 'ksu_health', name: 'جامعة الملك سعود - المسار الصحي (KSU)', hs: 30, qudrat: 30, tahsili: 40 },
  { id: 'custom', name: 'نسبة مخصصة', hs: 0, qudrat: 0, tahsili: 0 },
];

export const QiyasCalculatorModal: React.FC<QiyasCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultQudratScore,
}) => {
  const [highSchool, setHighSchool] = useState<number>(95);
  const [qudrat, setQudrat] = useState<number>(defaultQudratScore || 85);
  const [tahsili, setTahsili] = useState<number>(85);
  const [selectedUni, setSelectedUni] = useState(UNIVERSITIES[0]);

  // For custom weighting
  const [customHsWeight, setCustomHsWeight] = useState(30);
  const [customQudratWeight, setCustomQudratWeight] = useState(30);
  const [customTahsiliWeight, setCustomTahsiliWeight] = useState(40);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentWeights = useMemo(() => {
    if (selectedUni.id === 'custom') {
      return { hs: customHsWeight, qudrat: customQudratWeight, tahsili: customTahsiliWeight };
    }
    return { hs: selectedUni.hs, qudrat: selectedUni.qudrat, tahsili: selectedUni.tahsili };
  }, [selectedUni, customHsWeight, customQudratWeight, customTahsiliWeight]);

  const weightedScore = useMemo(() => {
    const totalWeight = currentWeights.hs + currentWeights.qudrat + currentWeights.tahsili;
    if (totalWeight === 0) return '0.00';

    const hsCalc = (highSchool * currentWeights.hs) / 100;
    const qudratCalc = (qudrat * currentWeights.qudrat) / 100;
    const tahsiliCalc = (tahsili * currentWeights.tahsili) / 100;

    return ((hsCalc + qudratCalc + tahsiliCalc) / (totalWeight / 100)).toFixed(2);
  }, [highSchool, qudrat, tahsili, currentWeights]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      data-testid="qiyas-calculator-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="حاسبة النسبة الموزونة"
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#2e2b70] to-indigo-700 text-white flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Calculator size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black">حاسبة النسبة الموزونة</h2>
              <p className="text-indigo-100 text-sm mt-0.5">احسب فرصتك للقبول الجامعي بدقة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 hover:bg-white/20 rounded-full transition-colors relative z-10"
          >
            <X size={24} />
          </button>

          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-400/20 rounded-full blur-xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Column */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">الجامعة / المسار المستهدف</label>
                <select
                  aria-label="الجامعة المستهدفة"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                  value={selectedUni.id}
                  onChange={(e) =>
                    setSelectedUni(UNIVERSITIES.find((u) => u.id === e.target.value) || UNIVERSITIES[0])
                  }
                >
                  {UNIVERSITIES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUni.id === 'custom' && (
                <div className="flex gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1 text-center">ثانوي %</label>
                    <input
                      type="number"
                      aria-label="نسبة الثانوي"
                      value={customHsWeight}
                      onChange={(e) => setCustomHsWeight(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-center font-bold text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1 text-center">قدرات %</label>
                    <input
                      type="number"
                      aria-label="نسبة القدرات"
                      value={customQudratWeight}
                      onChange={(e) => setCustomQudratWeight(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-center font-bold text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1 text-center">تحصيلي %</label>
                    <input
                      type="number"
                      aria-label="نسبة التحصيلي"
                      value={customTahsiliWeight}
                      onChange={(e) => setCustomTahsiliWeight(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-center font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {currentWeights.hs > 0 && (
                  <div>
                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                      <span>معدل الثانوية العامة</span>
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-black">{highSchool}%</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="0.5"
                      value={highSchool}
                      onChange={(e) => setHighSchool(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                )}

                {currentWeights.qudrat > 0 && (
                  <div>
                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                      <span>درجة القدرات العامة</span>
                      <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md font-black">{qudrat}%</span>
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      step="1"
                      value={qudrat}
                      onChange={(e) => setQudrat(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                )}

                {currentWeights.tahsili > 0 && (
                  <div>
                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                      <span>درجة التحصيلي</span>
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-black">{tahsili}%</span>
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      step="1"
                      value={tahsili}
                      onChange={(e) => setTahsili(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Result Column */}
            <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 p-6 text-center relative overflow-hidden shadow-inner">
              <div className="relative z-10 w-full flex flex-col items-center">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 text-indigo-600">
                  <Target size={28} />
                </div>
                <h3 className="text-gray-500 font-bold mb-1 text-sm">نسبتك الموزونة التقريبية</h3>

                <div className="text-5xl font-black text-indigo-950 mb-4 tracking-tight flex justify-center items-end" dir="ltr">
                  {weightedScore} <span className="text-2xl text-indigo-500 mb-1 ml-1">%</span>
                </div>

                <div className="h-px w-full bg-gray-200 my-4" />

                <div className="flex w-full justify-around text-xs font-bold text-gray-500 px-1">
                  {currentWeights.hs > 0 && (
                    <div className="text-center">
                      <div className="text-[11px] text-gray-400 mb-1">الثانوي</div>
                      <div className="text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm font-black">{currentWeights.hs}%</div>
                    </div>
                  )}
                  {currentWeights.qudrat > 0 && (
                    <div className="text-center">
                      <div className="text-[11px] text-gray-400 mb-1">القدرات</div>
                      <div className="text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm font-black">{currentWeights.qudrat}%</div>
                    </div>
                  )}
                  {currentWeights.tahsili > 0 && (
                    <div className="text-center">
                      <div className="text-[11px] text-gray-400 mb-1">التحصيلي</div>
                      <div className="text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm font-black">{currentWeights.tahsili}%</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-3xl shrink-0">
          <p className="text-xs text-gray-500 font-bold flex items-center gap-2">
            <Award size={16} className="text-amber-500" />
            حسّن درجة القدرات والتحصيلي معنا لرفع موزونتك!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

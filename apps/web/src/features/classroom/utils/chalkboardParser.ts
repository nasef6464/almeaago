export interface Step {
  stepNumber: number;
  title: string;
  explanation: string;
  latex?: string;
}

export const parseChalkboardSteps = (
  explanationText: string,
  questionText?: string,
): Step[] => {
  if (!explanationText || !explanationText.trim()) {
    return [
      {
        stepNumber: 1,
        title: 'قراءة وفهم المسألة',
        explanation: questionText || 'نحدد المطلوب والمعطيات للوصول إلى الحل.',
      },
      {
        stepNumber: 2,
        title: 'استنتاج الإجابة والتحقق',
        explanation: 'نراجع خطوات الحل للتأكد من مطابقة النتيجة للخيارات.',
      },
    ];
  }

  const raw = explanationText.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const stepPattern = /^(?:(\d+)[-.:)]\s*|(أولاً|ثانياً|ثالثاً|رابعاً|خامساً|الخطوة\s+\S+|القاعدة\s*\S*|الحساب|النتيجة(?:\s+النهائية)?|التحقق)[:\-]\s*)(.*)$/i;

  const steps: Step[] = [];
  let currentTitle = '';
  let currentBody: string[] = [];
  let stepCounter = 1;

  for (const line of lines) {
    const match = line.match(stepPattern);
    if (match) {
      if (currentBody.length > 0 || currentTitle) {
        steps.push(createStep(stepCounter++, currentTitle, currentBody.join(' ')));
        currentBody = [];
      }
      currentTitle = match[1] ? `الخطوة ${match[1]}` : match[2] || `الخطوة ${stepCounter}`;
      if (match[3]) currentBody.push(match[3]);
    } else {
      if (!currentTitle) {
        currentTitle = `الخطوة ${stepCounter}`;
      }
      currentBody.push(line);
    }
  }

  if (currentBody.length > 0 || currentTitle) {
    steps.push(createStep(stepCounter, currentTitle, currentBody.join(' ')));
  }

  if (steps.length === 1 && lines.length >= 2) {
    const sentences = raw.split(/[.،;\n]+/).map((s) => s.trim()).filter((s) => s.length > 5);
    if (sentences.length >= 2) {
      return sentences.map((sent, idx) => {
        let title = `الخطوة ${idx + 1}`;
        if (idx === 0) title = 'المعطيات والقاعدة';
        else if (idx === sentences.length - 1) title = 'النتيجة والتحقق';
        return createStep(idx + 1, title, sent);
      });
    }
  }

  return steps.length > 0
    ? steps
    : [createStep(1, 'خطوات الحل النموذجي', raw)];
};

function createStep(stepNumber: number, title: string, explanation: string): Step {
  let latex: string | undefined;
  const match = explanation.match(/\$\$([^$]+)\$\$|\$([^$]+)\$|\\\[([^\]]+)\\\]/);
  if (match) {
    latex = match[1] || match[2] || match[3];
  }
  return {
    stepNumber,
    title: title || `الخطوة ${stepNumber}`,
    explanation: explanation || title,
    latex: latex ? latex.trim() : undefined,
  };
}

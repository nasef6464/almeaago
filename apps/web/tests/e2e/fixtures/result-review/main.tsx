import { createRoot } from 'react-dom/client';
import { ReviewQuestionCard } from '../../../../src/features/assessment/pages/AssessmentResultsPage';
import type { ReviewQuestion, ResultDetail } from '../../../../src/features/assessment/api/attempt-client';
const question = {questionId: 'q-shuffled', questionVersion: 1, sectionId: '', sortOrder: 0, points: 1, type: 'mcq', text: 'اختر الإجابة', imageAssetId: '', imageUrl: '', imageAlt: '', optionsEmbeddedInImage: false, videoUrl: '', difficulty: 'easy', options: [{index: 1, text: 'الخيار الثاني', assetId: ''}, {index: 0, text: 'الخيار الأول', assetId: ''}], selectedOptionIndex: 1, correctOptionIndex: 0, answered: true, correct: false, markedForReview: false, timeSpentSeconds: 0} as ReviewQuestion;
const detail = {showAnswers: true, showExplanations: false} as ResultDetail;
createRoot(document.getElementById('root')!).render(<ReviewQuestionCard question={question} detail={detail} saved={false} saving={false} onSave={() => {}} />);

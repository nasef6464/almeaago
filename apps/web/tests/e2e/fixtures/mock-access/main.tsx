import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../../../src/app/styles.css';
import { PathMockExamsView } from '../../../../src/features/public/header/pages/PathMockExamsView';

const items = [
  { id: 'open', pathId: 'path', title: 'محاكي متاح', questionCount: 60, sectionCount: 3, timeLimitSeconds: 3600 },
  { id: 'locked', pathId: 'path', title: 'محاكي ضمن باقة', questionCount: 80, sectionCount: 4, timeLimitSeconds: 4800 },
  { id: 'purchased', pathId: 'path', title: 'محاكي مشترك فيه', questionCount: 40, sectionCount: 2, timeLimitSeconds: 2400 },
];
createRoot(document.getElementById('root')!).render(<MemoryRouter><PathMockExamsView path={{ id: 'path', name: 'القدرات' }} subjects={[]} catalogView={{ items, totals: { count: 3, questions: 180, sections: 9, minutes: 180 } }} guest={false} isStudent returnTo="/category/path?tab=mock-exams" starting="" startError="" accessById={{ open: 'allowed', locked: 'locked', purchased: 'purchased' }} onRetryAccess={() => {}} onStart={() => {}} onBack={() => {}} /></MemoryRouter>);

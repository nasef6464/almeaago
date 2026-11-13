import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { QuestionSectionEditor } from '../../../src/features/questionbank/components/QuestionSectionEditor';

createRoot(document.getElementById('root')!).render(<QuestionSectionEditor questionId="question1" subjectId="subject1" sections={[{ id: 'section1', subjectId: 'subject1', name: 'الأعداد', sortOrder: 1 }, { id: 'section2', subjectId: 'subject2', name: 'مادة أخرى', sortOrder: 1 }]} getCsrfToken={async () => 'csrf'} />);

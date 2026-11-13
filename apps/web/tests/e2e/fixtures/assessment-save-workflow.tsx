import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { AssessmentEditorPanel } from '../../../src/features/assessment/components/AssessmentEditorPanel';

function App() {
  const [done, setDone] = useState(false);
  const params = new URLSearchParams(location.search);
  const isAdmin = params.get('role') !== 'teacher';
  const live = params.get('live') === '1';
  const path = live ? '00000000-0000-0000-0000-000000000003' : 'path-1';
  const subject = live ? '00000000-0000-0000-0000-000000000004' : 'subject-1';
  const csrf = async () => live ? (await (await fetch('/api/v1/auth/csrf')).json()).csrfToken : 'csrf';
  return done ? <p>تم التسليم للقائمة</p> : <AssessmentEditorPanel taxonomy={{ paths: [{ id: path, code: 'p', name: 'مسار', sortOrder: 0 }], subjects: [{ id: subject, pathId: path, code: 's', name: 'مادة', sortOrder: 0 }] }} initialPathId={path} initialSubjectId={subject} isAdmin={isAdmin} lockScope={!isAdmin} getCsrfToken={csrf} onCancel={() => setDone(true)} onSaved={() => setDone(true)} />;
}
createRoot(document.getElementById('root')!).render(<App />);

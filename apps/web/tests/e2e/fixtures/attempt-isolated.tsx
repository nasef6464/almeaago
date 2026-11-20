import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../src/features/auth/state/AuthProvider';
import { AssessmentAttemptPage } from '../../../src/features/assessment/pages/AssessmentAttemptPage';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={['/assessments/assessment-1/start']}>
      <Routes><Route path="/assessments/:assessmentId/start" element={<AssessmentAttemptPage />} /></Routes>
    </MemoryRouter>
  </AuthProvider>,
);

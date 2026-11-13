import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { PreparedQuizAdminPanel } from '../../../src/features/assessment/components/PreparedQuizAdminPanel';

createRoot(document.getElementById('root')!).render(<PreparedQuizAdminPanel assessmentId="assessment" getCsrfToken={async () => 'csrf'} />);

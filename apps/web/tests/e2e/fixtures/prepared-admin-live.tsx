import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { authClient } from '../../../src/features/auth/api/auth-client';
import { PreparedQuizAdminPanel } from '../../../src/features/assessment/components/PreparedQuizAdminPanel';

const id = new URLSearchParams(window.location.search).get('assessmentId') || '';
createRoot(document.getElementById('root')!).render(
  <PreparedQuizAdminPanel assessmentId={id} getCsrfToken={async () => (await authClient.csrf()).csrfToken} />,
);

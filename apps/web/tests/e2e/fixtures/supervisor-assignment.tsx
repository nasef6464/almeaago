import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { AuthProvider } from '../../../src/features/auth/state/AuthProvider';
import { SupervisorTestsManager } from '../../../src/features/organizations/components/SupervisorTestsManager';

const classes = [{ id: 'class-a', name: 'الفصل الأول' }];
createRoot(document.getElementById('root')!).render(<AuthProvider><SupervisorTestsManager schoolId="school-a" classes={classes} roleMode="teacher" /></AuthProvider>);

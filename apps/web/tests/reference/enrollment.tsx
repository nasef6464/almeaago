import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/state/AuthProvider';
import { PathEnrollmentDialog, StudentNavigationProvider, useStudentExperience } from '../../src/features/learning/navigation';
import { PathEnrollmentDialog as SourceDialog } from './generated/EnrollmentSource';
import '../../src/app/styles.css';

declare global { interface Window { __setEnrollmentVariant?: (variant: 'source' | 'go') => void } }
function Reference() {
  const navigation = useStudentExperience();
  const [variant, setVariant] = useState<'source' | 'go'>('source');
  useEffect(() => {
    window.__setEnrollmentVariant = setVariant;
    return () => { delete window.__setEnrollmentVariant; };
  }, []);
  return <main data-testid="enrollment-reference" data-variant={variant} data-ready={!navigation.loading ? 'true' : 'false'} dir="rtl" className="min-h-screen bg-white">
    <button type="button" onClick={() => navigation.openEnrollment('target-path')}>افتح اختيار المسار</button>
    {variant === 'source' ? <SourceDialog /> : <PathEnrollmentDialog />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><StudentNavigationProvider><Reference /></StudentNavigationProvider></AuthProvider></BrowserRouter>);

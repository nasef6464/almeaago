import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../../../src/features/auth/state/AuthProvider';
import { InteractiveSmartTeacher } from '../../../src/features/ai/components/InteractiveSmartTeacher';
import '../../../src/app/styles.css';

const fromResult = new URLSearchParams(window.location.search).get('mode') === 'result';
createRoot(document.getElementById('root')!).render(<AuthProvider><InteractiveSmartTeacher isOpen onClose={() => {}} questionId="question-1" reviewCardId={fromResult ? undefined : 'card-1'} resultId={fromResult ? 'attempt-1' : undefined} questionText="مسألة تجريبية" /></AuthProvider>);

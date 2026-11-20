import { createRoot } from 'react-dom/client';
import { StepSolutionModal } from '../../../src/features/classroom/components/whiteboard/StepSolutionPlayer';

createRoot(document.getElementById('root')!).render(<StepSolutionModal isOpen onClose={() => {}} questionText="سؤال بلا شرح" />);

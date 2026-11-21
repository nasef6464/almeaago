import { createRoot } from 'react-dom/client';
import { normalizeQuestionHtml } from '../../../src/lib/questionHtml';

const input = '<strong>سؤال</strong> .... $x^2$ <svg onload="window.sharedAttack=1"></svg><a href="javascript:window.sharedAttack=2">رابط</a>';
createRoot(document.getElementById('root')!).render(<div data-testid="normalized" dangerouslySetInnerHTML={{__html:normalizeQuestionHtml(input)}} />);

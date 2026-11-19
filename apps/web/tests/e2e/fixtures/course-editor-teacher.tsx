import { createRoot } from 'react-dom/client';
import { CourseEditorPanel } from '../../../src/features/content/components/CourseEditorPanel';
import '../../../src/app/styles.css';

const params = new URLSearchParams(window.location.search);
const courseId = params.get('course') || '';
const actorId = params.get('actor') || '';
const core = {paths:[],subjects:[]};
async function csrf() {
  const response = await fetch('/api/v1/auth/csrf', {credentials:'include'});
  if (!response.ok) throw new Error('تعذر التحقق من الجلسة.');
  return (await response.json()).csrfToken as string;
}
createRoot(document.getElementById('root')!).render(<CourseEditorPanel courseId={courseId} actorId={actorId} coreTaxonomy={core} isAdmin={false} lockScope getCsrfToken={csrf} onCancel={() => {}} onChanged={() => {}} />);

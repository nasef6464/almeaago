import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { CourseEditorPanel } from '../../../src/features/content/components/CourseEditorPanel';
const core = { paths: [{id:'path-1',code:'p',name:'مسار',sortOrder:0}], subjects: [{id:'sub-1',pathId:'path-1',code:'s',name:'مادة',sortOrder:0}] };
createRoot(document.getElementById('root')!).render(<CourseEditorPanel courseId="course-1" actorId="fixture-admin" coreTaxonomy={core} isAdmin lockScope={false} getCsrfToken={async () => 'csrf'} onCancel={() => {}} onChanged={() => {}} />);

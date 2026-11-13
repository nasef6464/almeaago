import React from 'react';
import { createRoot } from 'react-dom/client';
import { AssessmentEditorPanel } from '../../../../src/features/assessment/components/AssessmentEditorPanel';
const taxonomy = {paths:[{id:'11111111-1111-4111-8111-111111111111',code:'QUDRAT',name:'القدرات'}],subjects:[{id:'22222222-2222-4222-8222-222222222222',pathId:'11111111-1111-4111-8111-111111111111',code:'QUANT',name:'الكمي'},{id:'33333333-3333-4333-8333-333333333333',pathId:'11111111-1111-4111-8111-111111111111',code:'VERBAL',name:'اللفظي'}]};
createRoot(document.getElementById('root')!).render(<AssessmentEditorPanel taxonomy={taxonomy as never} initialPathId="11111111-1111-4111-8111-111111111111" initialSubjectId="22222222-2222-4222-8222-222222222222" isAdmin lockScope={false} getCsrfToken={async () => 'csrf'} onCancel={() => {}} onSaved={() => {}} />);

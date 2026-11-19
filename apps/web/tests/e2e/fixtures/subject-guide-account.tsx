import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../../src/features/auth/state/AuthProvider';
import { LearningSpacePage } from '../../../src/features/learning/pages/LearningSpacePage';

function Fixture() {
  const { signIn } = useAuth();
  return <><button type="button" onClick={() => void signIn('second@example.invalid', 'test')}>تبديل الطالب</button><LearningSpacePage /></>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/category/p1?subject=s1&tab=skills']}><AuthProvider><Routes><Route path="/category/:pathId" element={<Fixture />} /></Routes></AuthProvider></MemoryRouter>);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FloatingContactWidget } from '../../../../src/features/support/FloatingContactWidget';
createRoot(document.getElementById('root')!).render(<BrowserRouter><FloatingContactWidget /></BrowserRouter>);

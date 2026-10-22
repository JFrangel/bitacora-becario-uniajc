import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import '../src/styles/index.css';
import { DemoBar } from './DemoBar';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DemoBar />
  </StrictMode>,
);

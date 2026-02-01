import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Privacy from './components/Privacy';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Privacy />
  </StrictMode>
);

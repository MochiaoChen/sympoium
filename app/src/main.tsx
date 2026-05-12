/**
 * Main entry point — no StrictMode (per react-dev.md guidelines)
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

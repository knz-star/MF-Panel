import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('MF MPanel startup failed: #root element is missing from index.html');

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

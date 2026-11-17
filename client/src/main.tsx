import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { GameSession } from './net/GameSession';
import { SessionContext } from './net/useSession';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found in index.html');

// One session per tab, created outside React so StrictMode never duplicates the socket.
const session = new GameSession();
session.connect();

createRoot(rootElement).render(
  <StrictMode>
    <SessionContext.Provider value={session}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </SessionContext.Provider>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { AppPreferencesProvider } from './shared/preferences/AppPreferencesProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppPreferencesProvider>
      <App />
    </AppPreferencesProvider>
  </React.StrictMode>,
);

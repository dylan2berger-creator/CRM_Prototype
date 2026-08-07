import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { DataProvider } from '@/data/DataContext';
import { RoleProvider } from '@/app/RoleContext';
import { ModeProvider } from '@/app/ModeContext';
import './fonts.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DataProvider>
        <RoleProvider>
          <ModeProvider>
            <App />
          </ModeProvider>
        </RoleProvider>
      </DataProvider>
    </HashRouter>
  </React.StrictMode>,
);

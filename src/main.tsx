import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DataProvider } from '@/data/DataContext';
import { RoleProvider } from '@/app/RoleContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DataProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

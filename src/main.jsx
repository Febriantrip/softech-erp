import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ApiAuthProvider } from './context/ApiAuthContext';
import { ERPDataProvider } from './context/ERPDataContext';
import { OrgProvider } from './context/OrgContext';
import { initializeTheme, ThemeProvider } from './context/ThemeContext';
import './styles.css';
import './enterprise.css';
import './governance.css';
import './v9-distribution.css';
import './v10-production.css';
import './v11-core-transactions.css';
import './v12-financial-engine.css';
import './sales-order-detailing.css';
import './theme-aurora-dark.css';
import './theme-aurora-noir-shell.css';
import './auth/login.css';
import './auth/login-v2.css';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ERPDataProvider>
        <ThemeProvider>
          <OrgProvider>
            <ApiAuthProvider><App /></ApiAuthProvider>
          </OrgProvider>
        </ThemeProvider>
      </ERPDataProvider>
    </BrowserRouter>
  </React.StrictMode>
);

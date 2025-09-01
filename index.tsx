/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// CRITICAL: Replace these placeholders with your actual Auth0 configuration.
// You can find these values in your Auth0 Application and API settings.
const AUTH0_DOMAIN = '__AUTH0_DOMAIN__';
const AUTH0_CLIENT_ID = '__AUTH0_CLIENT_ID__';
const AUTH0_AUDIENCE = '__AUTH0_AUDIENCE__'; // This is the 'Identifier' from your Auth0 API settings.

if (AUTH0_DOMAIN.startsWith('__')) {
  alert('Authentication is not configured. Please edit index.tsx and replace the Auth0 placeholders.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
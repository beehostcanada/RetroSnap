/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { UserProvider } from './contexts/AuthContext';
import DebugPage from './pages/DebugPage';

// --- Simple Error Boundary for Catching Critical Errors ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '8px', margin: '20px' }}>
          <h1 style={{ color: '#d9534f' }}>Application Error</h1>
          <p>Something went wrong, which is preventing the app from loading. This is often caused by an authentication configuration issue.</p>
          <p style={{ marginTop: '10px' }}>Please double-check the following in your Auth0 dashboard:</p>
          <ul style={{ listStyleType: 'decimal', marginLeft: '20px', marginTop: '5px' }}>
              <li>The <strong>Allowed Callback URL</strong> and <strong>Allowed Web Origins</strong> match the URL from the setup guide.</li>
              <li>You have created an API with the correct <strong>Identifier (Audience)</strong> as shown in the setup guide.</li>
          </ul>
          <p style={{ marginTop: '10px' }}>Please check the developer note at the top of the screen (if visible) or your browser's developer console for more details.</p>
          <details style={{ marginTop: '15px' }}>
            <summary>Error Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f9f9f9', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
// --- End Error Boundary ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// NOTE: Please replace these with your own Auth0 application's Domain and Client ID.
const AUTH0_DOMAIN = 'dev-c10yl0evqx45fbln.us.auth0.com';
const AUTH0_CLIENT_ID = 'RbFcz8pmjKqXHBhKCh7yVg5QSm5EjQ1A';
// Dynamically create a unique identifier for the API based on the deployment hostname.
const AUTH0_AUDIENCE = `https://api.retrosnap.com`;


/**
 * A mock auth provider for local development to bypass Auth0 login.
 */
const DevProvider = ({ children }: { children: ReactNode }) => {
    const devAuthValue = {
        user: {
            name: 'Dev User',
            email: 'dev@example.com',
            picture: `https://ui-avatars.com/api/?name=Dev+User&background=random`,
        },
        isAuthenticated: true,
        isLoading: false,
        loginWithRedirect: () => {
            console.log('Mock login: already logged in.');
            return Promise.resolve();
        },
        logout: (options?: { logoutParams?: { returnTo?: string } }) => {
            console.log('Mock logout called. In a real app, you would be redirected to:', options?.logoutParams?.returnTo);
        },
        getAccessTokenSilently: async () => 'dev-token',
        credits: 99,
        isAdmin: true,
        deductCredit: () => console.log('Mock credit deducted.'),
    };

    return (
        <UserProvider useAuthHook={() => devAuthValue}>
            {children}
        </UserProvider>
    );
};

const AppWrapper = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/debug" element={<DebugPage />} />
            </Routes>
        </BrowserRouter>
    );
};

const Main = () => {
    // Bypass Auth0 on localhost (and in the dev IDE) for easier development.
    const isDev = window.location.hostname === 'localhost' || window.location.hostname.endsWith('.sercontent.goog');

    if (isDev) {
        return (
            <DevProvider>
                <AppWrapper />
            </DevProvider>
        );
    }
    
    return (
        <Auth0Provider
            domain={AUTH0_DOMAIN}
            clientId={AUTH0_CLIENT_ID}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: AUTH0_AUDIENCE,
            }}
            cacheLocation="localstorage"
        >
            <UserProvider>
                <AppWrapper />
            </UserProvider>
        </Auth0Provider>
    );
};


const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  </React.StrictMode>
);
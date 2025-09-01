/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import netlifyIdentity, { User } from 'netlify-identity-widget';

interface AuthContextType {
  currentUser: User | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(netlifyIdentity.currentUser());

  useEffect(() => {
    // Initialize Netlify Identity when the app loads.
    // The `#` is a workaround for a known issue with the widget in some SPA setups.
    if (window.location.hash.includes('_token=')) {
        netlifyIdentity.handleRedirect();
    } else {
        netlifyIdentity.init();
    }

    const handleLogin = (user: User) => {
      console.log('User logged in:', user);
      setCurrentUser(user);
      netlifyIdentity.close();
    };

    const handleLogout = () => {
      console.log('User logged out');
      setCurrentUser(null);
    };

    netlifyIdentity.on('login', handleLogin);
    netlifyIdentity.on('logout', handleLogout);
    netlifyIdentity.on('init', (user) => {
      if (user) {
        setCurrentUser(user);
      }
    });

    return () => {
      netlifyIdentity.off('login', handleLogin);
      netlifyIdentity.off('logout', handleLogout);
    };
  }, []);

  const login = () => {
    netlifyIdentity.open('login');
  };

  const logout = () => {
    netlifyIdentity.logout();
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

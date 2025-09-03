/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth0, User } from '@auth0/auth0-react';
import { getCredits } from '../services/geminiService';

interface UserContextType {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: boolean;
    credits: number | null;
    loginWithRedirect: (options?: any) => Promise<void>;
    logout: (options?: any) => void;
    getAccessTokenSilently: (options?: any) => Promise<string>;
    fetchUserData: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUserContext = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUserContext must be used within a UserProvider');
    }
    return context;
};

interface UserProviderProps {
    children: ReactNode;
    useAuthHook?: () => any; // For dev environment mocking
}

export const UserProvider = ({ children, useAuthHook = useAuth0 }: UserProviderProps) => {
    const auth = useAuthHook();
    const isMock = useAuthHook !== useAuth0;
    
    // If using mock, state comes directly from it. If not, it's fetched from the backend.
    const [credits, setCredits] = useState<number | null>(isMock ? auth.credits : null);
    const [isAdmin, setIsAdmin] = useState<boolean>(isMock ? auth.isAdmin : false);

    const fetchUserData = useCallback(async () => {
        // Never fetch from the API if using the mock provider.
        // The user data is static and set during initial state.
        if (isMock) {
            return;
        }

        if (auth.isAuthenticated) {
            try {
                const token = await auth.getAccessTokenSilently();
                const data = await getCredits(token);
                setCredits(data.credits);
                setIsAdmin(data.isAdmin);
            } catch (error) {
                console.error("Failed to fetch user data:", error);
                // In case of error, reset to safe defaults
                setCredits(0);
                setIsAdmin(false);
            }
        }
    }, [isMock, auth.isAuthenticated, auth.getAccessTokenSilently]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const value: UserContextType = {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        credits,
        isAdmin,
        loginWithRedirect: auth.loginWithRedirect,
        logout: auth.logout,
        getAccessTokenSilently: auth.getAccessTokenSilently,
        fetchUserData
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

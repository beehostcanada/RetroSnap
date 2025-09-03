/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth0, User } from '@auth0/auth0-react';
import { getCredits } from '../services/geminiService';

type Status = 'pending' | 'loading' | 'success' | 'error';

interface UserContextType {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean; // A single, derived loading state for consumers.
    status: Status; // The explicit state of the authentication and data-fetching process.
    error: Error | null; // Holds authentication or data fetching errors.
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
    
    const [credits, setCredits] = useState<number | null>(isMock ? auth.credits : null);
    const [isAdmin, setIsAdmin] = useState<boolean>(isMock ? auth.isAdmin : false);
    const [status, setStatus] = useState<Status>('pending');
    const [error, setError] = useState<Error | null>(null);

    // This single effect orchestrates the entire session verification and data loading process.
    // It's architected to be resilient to race conditions and to clearly distinguish between
    // a "logged out" state and a true application error.
    useEffect(() => {
        if (isMock) {
            setStatus('success');
            return;
        }

        const verifySessionAndFetchData = async () => {
            setStatus('loading');
            setError(null); // Clear previous errors on a new attempt.

            // If Auth0 says we are not authenticated, that is our source of truth.
            // We consider this a 'success' in determining the user's state (they are logged out).
            if (!auth.isAuthenticated) {
                setCredits(null);
                setIsAdmin(false);
                setStatus('success');
                return;
            }

            // If we reach here, Auth0 believes the user IS authenticated.
            // Any failure from this point on is a critical application error (e.g., backend misconfiguration).
            try {
                const token = await auth.getAccessTokenSilently();
                const data = await getCredits(token);
                setCredits(data.credits);
                setIsAdmin(data.isAdmin);
                setStatus('success');
            } catch (err: any) {
                console.error("Critical error during authenticated data fetch:", err);
                // The error is guaranteed to be a real problem, not a login issue.
                // We set the error state so UI components like AdminPage can display it.
                setError(err as Error);
                setStatus('error');
                setCredits(null);
                setIsAdmin(false);
            }
        };

        // We only run the verification logic once the Auth0 SDK is finished loading.
        if (!auth.isLoading) {
            verifySessionAndFetchData();
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.getAccessTokenSilently, isMock]);


    // This function is for MANUAL refreshes (e.g., after an action).
    const fetchUserData = useCallback(async () => {
        if (isMock || !auth.isAuthenticated) {
            return;
        }
        try {
            const token = await auth.getAccessTokenSilently();
            const data = await getCredits(token);
            setCredits(data.credits);
            setIsAdmin(data.isAdmin);
        } catch (error) {
            console.error("Manual user data refresh failed:", error);
        }
    }, [isMock, auth.isAuthenticated, auth.getAccessTokenSilently]);

    const value: UserContextType = {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: status === 'pending' || status === 'loading',
        status,
        error,
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

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

    // This single effect orchestrates the entire session verification and data loading process,
    // making it resilient to the auth provider's race conditions.
    useEffect(() => {
        if (isMock) {
            setStatus('success');
            return;
        }

        if (!auth.isLoading) {
            const verifySessionAndFetchData = async () => {
                setStatus('loading');
                setError(null); // Clear previous errors on a new attempt.
                try {
                    const token = await auth.getAccessTokenSilently();
                    const data = await getCredits(token);
                    setCredits(data.credits);
                    setIsAdmin(data.isAdmin);
                    setStatus('success');
                } catch (err: any) {
                    console.error("Session verification or data fetch failed:", err);
                    setCredits(null);
                    setIsAdmin(false);

                    // Distinguish between a user who isn't logged in vs. a real configuration error.
                    // 'login_required' is a normal state, not an application error.
                    if (err?.error === 'login_required') {
                        setError(null);
                        setStatus('success'); // Successfully determined user is logged out.
                    } else {
                        // Any other error is unexpected and should be surfaced to the user.
                        setError(err as Error);
                        setStatus('error');
                    }
                }
            };
            verifySessionAndFetchData();
        }
    }, [auth.isLoading, auth.getAccessTokenSilently, isMock]);


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
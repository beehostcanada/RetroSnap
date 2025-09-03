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

    // This effect handles the crucial INITIAL data load and is designed
    // to be resilient to the auth provider's race conditions.
    useEffect(() => {
        // While Auth0 is loading, we are always in a pending state.
        if (auth.isLoading) {
            setStatus('pending');
            return;
        }

        // If Auth0 is done, and the user is authenticated...
        if (auth.isAuthenticated) {
            // ...but we have NOT fetched their data yet (credits is null)...
            // This `credits === null` check is the key to the fix. It prevents
            // this block from running during the transitional state where isAuthenticated
            // flips from false to true, and prevents infinite loops.
            if (credits === null) {
                const performInitialFetch = async () => {
                    setStatus('loading');
                    try {
                        const token = await auth.getAccessTokenSilently();
                        const data = await getCredits(token);
                        setCredits(data.credits);
                        setIsAdmin(data.isAdmin);
                        setStatus('success');
                    } catch (error) {
                        console.error("Initial user data fetch failed:", error);
                        setCredits(0);
                        setIsAdmin(false);
                        setStatus('error');
                    }
                };
                performInitialFetch();
            }
        } else {
            // If Auth0 is done and the user is NOT authenticated, this is a final state.
            // We can safely set their data to the logged-out defaults.
            setCredits(null);
            setIsAdmin(false);
            setStatus('success');
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.getAccessTokenSilently, credits]);

    // This function is for MANUAL refreshes (e.g., after an action).
    // It is separate from the initial load logic in the useEffect.
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
            // In a real app, you might show a toast notification here.
        }
    }, [isMock, auth.isAuthenticated, auth.getAccessTokenSilently]);

    const value: UserContextType = {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: status === 'pending' || status === 'loading',
        status,
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth0, User } from '@auth0/auth0-react';
import { fetchUserData } from '../services/geminiService';

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
    deductCredit: () => void;
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
    useEffect(() => {
        if (isMock) {
            setStatus('success');
            return;
        }

        const verifySessionAndFetchData = async () => {
            setStatus('loading');
            setError(null);

            if (!auth.isAuthenticated) {
                // User is logged out. Clear all session state.
                setCredits(null);
                setIsAdmin(false);
                setStatus('success');
                return;
            }

            // User is authenticated. Fetch admin status and persistent credits from the backend.
            try {
                const token = await auth.getAccessTokenSilently();
                const { isAdmin, credits } = await fetchUserData(token);
                setIsAdmin(isAdmin);
                setCredits(credits);
                
                setStatus('success');
            } catch (err: any) {
                console.error("Critical error during authenticated data fetch:", err);
                setError(err as Error);
                setStatus('error');
                setCredits(null);
                setIsAdmin(false);
            }
        };

        if (!auth.isLoading) {
            verifySessionAndFetchData();
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.getAccessTokenSilently, isMock]);


    // Function to decrement credits locally for immediate UI feedback.
    // The authoritative deduction happens on the backend.
    const deductCredit = useCallback(() => {
        if (isMock) {
            auth.deductCredit();
            return;
        }
        setCredits(prev => {
            if (prev === null) return null;
            return Math.max(0, prev - 1);
        });
    }, [isMock, auth]);

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
        deductCredit
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
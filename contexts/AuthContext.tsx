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

    // This single effect orchestrates the entire session verification and data loading process,
    // making it resilient to the auth provider's race conditions.
    useEffect(() => {
        // If we're in the mock dev environment, set success state immediately.
        if (isMock) {
            setStatus('success');
            return;
        }

        // Only proceed when the Auth0 provider is no longer in its initial loading phase.
        if (!auth.isLoading) {
            const verifySessionAndFetchData = async () => {
                // We are now verifying the session, so we enter our own loading state.
                setStatus('loading');
                try {
                    // This is the critical step. We actively try to get a token.
                    // If the user is not logged in, this will throw an error and jump to the catch block.
                    // This avoids relying on the potentially racy `isAuthenticated` flag from Auth0.
                    const token = await auth.getAccessTokenSilently();

                    // If we get a token, the user is authenticated. Now fetch their specific data.
                    const data = await getCredits(token);
                    setCredits(data.credits);
                    setIsAdmin(data.isAdmin);
                    setStatus('success'); // All data is loaded.
                } catch (error) {
                    // This catch block handles both "login required" errors from getAccessTokenSilently
                    // and any potential network errors from our getCredits call.
                    // In either case, we treat the user as logged out.
                    console.log("Session verification or data fetch failed (user likely not logged in):", error);
                    setCredits(null);
                    setIsAdmin(false);
                    // We have successfully determined the user is not logged in, so we move to the 'success'
                    // state for a logged-out user. The UI can now render the login button.
                    setStatus('success');
                }
            };
            verifySessionAndFetchData();
        }
        // This effect should run ONLY when Auth0's loading status changes.
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
            // In a real app, you might show a toast notification here.
        }
    }, [isMock, auth.isAuthenticated, auth.getAccessTokenSilently]);

    const value: UserContextType = {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        // The isLoading flag is now a reliable, single source of truth for the entire app.
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
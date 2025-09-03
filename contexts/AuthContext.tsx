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
    
    const [credits, setCredits] = useState<number | null>(isMock ? auth.credits : null);
    const [isAdmin, setIsAdmin] = useState<boolean>(isMock ? auth.isAdmin : false);
    const [isUserDataLoading, setIsUserDataLoading] = useState<boolean>(!isMock);

    const fetchUserData = useCallback(async () => {
        if (isMock) {
            setIsUserDataLoading(false);
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
                setCredits(0);
                setIsAdmin(false);
            } finally {
                setIsUserDataLoading(false);
            }
        } else {
            // If user is not authenticated, we are not loading their data.
            setIsUserDataLoading(false);
        }
    }, [isMock, auth.isAuthenticated, auth.getAccessTokenSilently]);

    useEffect(() => {
        // Fetch user data only when Auth0 is done authenticating.
        if (!auth.isLoading) {
            fetchUserData();
        }
    }, [auth.isLoading, fetchUserData]);

    const value: UserContextType = {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        // The app is considered "loading" if Auth0 is loading, or if we've authenticated
        // but haven't finished fetching our own user data (credits, admin status).
        isLoading: auth.isLoading || (auth.isAuthenticated && isUserDataLoading),
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
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
    const { 
        user, 
        isAuthenticated, 
        isLoading,
        loginWithRedirect,
        logout,
        getAccessTokenSilently 
    } = useAuthHook();
    
    const [credits, setCredits] = useState<number | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const fetchUserData = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const token = await getAccessTokenSilently();
            const data = await getCredits(token);
            setCredits(data.credits);
            setIsAdmin(data.isAdmin);
        } catch (error) {
            console.error("Failed to fetch user data:", error);
            // In case of error, reset to safe defaults
            setCredits(0);
            setIsAdmin(false);
        }
    }, [isAuthenticated, getAccessTokenSilently]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const value = {
        user,
        isAuthenticated,
        isLoading,
        credits,
        isAdmin,
        loginWithRedirect,
        logout,
        getAccessTokenSilently,
        fetchUserData
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
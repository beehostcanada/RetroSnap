/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, updateUserCredits } from '../services/geminiService';
import Footer from '../components/Footer';

const ADMIN_EMAIL = 'dev@example.com'; // Should match the one in Footer.tsx and Netlify env vars

interface User {
    id: string;
    email: string;
    credits: number;
}

interface AppProps {
    useAuthHook?: () => any;
}

const AdminPage = ({ useAuthHook = useAuth0 }: AppProps) => {
    const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuthHook();
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [loadingMessage, setLoadingMessage] = useState('Checking permissions...');
    const [error, setError] = useState<string | null>(null);
    const [editCredits, setEditCredits] = useState<Record<string, string>>({});

    const fetchUsers = useCallback(async () => {
        setLoadingMessage('Fetching user data...');
        setError(null);
        try {
            const token = await getAccessTokenSilently();
            const userList = await getAllUsers(token);
            // Sort by email for consistent ordering
            userList.sort((a, b) => a.email.localeCompare(b.email));
            setUsers(userList);
            const initialEdits = userList.reduce((acc, u) => {
                acc[u.email] = String(u.credits);
                return acc;
            }, {} as Record<string, string>);
            setEditCredits(initialEdits);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoadingMessage('');
        }
    }, [getAccessTokenSilently]);

    useEffect(() => {
        if (isLoading) {
            return; // Wait for auth state to be resolved
        }
        if (!isAuthenticated) {
            navigate('/'); // Redirect if not logged in
        } else if (user?.email !== ADMIN_EMAIL) {
            setError('Access Denied. You are not authorized to view this page.');
            setLoadingMessage('');
        } else {
            fetchUsers();
        }
    }, [isLoading, isAuthenticated, user, navigate, fetchUsers]);

    const handleCreditChange = (email: string, value: string) => {
        setEditCredits(prev => ({ ...prev, [email]: value }));
    };

    const handleUpdateCredits = async (email: string) => {
        const newCreditsStr = editCredits[email];
        const newCredits = parseInt(newCreditsStr, 10);

        if (isNaN(newCredits) || newCredits < 0) {
            alert("Please enter a valid non-negative number for credits.");
            return;
        }

        try {
            const token = await getAccessTokenSilently();
            await updateUserCredits(token, email, newCredits);
            alert(`Successfully updated credits for ${email} to ${newCredits}.`);
            // Refresh user list to confirm change
            fetchUsers();
        } catch (err) {
            console.error("Failed to update credits:", err);
            alert(`Error: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
        }
    };

    const renderContent = () => {
        if (loadingMessage) {
            return <p className="text-center text-stone-500 text-lg animate-pulse">{loadingMessage}</p>;
        }
        if (error) {
            return <p className="text-center text-red-600 font-bold text-lg">{error}</p>;
        }
        return (
            <div className="w-full max-w-4xl bg-white/50 p-6 rounded-lg shadow-md border border-stone-200">
                <h2 className="text-3xl font-permanent-marker text-stone-700 mb-6 text-center">User Credit Management</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left">
                        <thead className="bg-stone-200/50">
                            <tr>
                                <th className="p-3 font-permanent-marker text-stone-600">Email</th>
                                <th className="p-3 font-permanent-marker text-stone-600">Current Credits</th>
                                <th className="p-3 font-permanent-marker text-stone-600 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(({ email, credits }) => (
                                <tr key={email} className="border-b border-stone-200 last:border-b-0">
                                    <td className="p-3 font-mono text-stone-800">{email}</td>
                                    <td className="p-3 font-mono text-center text-stone-800">{credits}</td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <input
                                                type="number"
                                                value={editCredits[email] || ''}
                                                onChange={(e) => handleCreditChange(email, e.target.value)}
                                                className="w-24 px-2 py-1 border border-stone-300 rounded-sm text-center"
                                                min="0"
                                                aria-label={`New credit amount for ${email}`}
                                            />
                                            <button
                                                onClick={() => handleUpdateCredits(email)}
                                                className="font-permanent-marker text-sm text-center text-white bg-teal-500 py-1 px-4 rounded-sm transition-all duration-200 hover:bg-teal-600 disabled:bg-gray-400"
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <main className="bg-[#FFF9E8] text-stone-800 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-32">
            <div className="text-center mb-10">
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-caveat font-bold text-rainbow">RetroSnap</h1>
                <p className="font-permanent-marker text-stone-600 mt-2 text-xl tracking-wide">Admin Panel</p>
            </div>
            {renderContent()}
            <Footer useAuthHook={useAuthHook} />
        </main>
    );
};

export default AdminPage;

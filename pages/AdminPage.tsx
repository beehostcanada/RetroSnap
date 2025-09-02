/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';
import { getAdminUsers, addCreditsToUser, AdminUser } from '../services/geminiService';

// IMPORTANT: This list must be kept in sync with the one in `netlify/functions/api-proxy.ts`
// This is used for client-side checks to show/hide UI elements.
// The actual security is enforced on the server.
const ADMIN_USERS = ['ajbatac@gmail.com'];

interface AdminPageProps {
    useAuthHook?: () => any;
}

const AdminPage: React.FC<AdminPageProps> = ({ useAuthHook = useAuth0 }) => {
    const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuthHook();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
    const [addingCredits, setAddingCredits] = useState<Record<string, boolean>>({});

    const isUserAdmin = user && ADMIN_USERS.includes(user.email);

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        setError(null);
        try {
            const token = await getAccessTokenSilently();
            const adminUsers = await getAdminUsers(token);
            setUsers(adminUsers);
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            setError(`Failed to load users: ${message}`);
            console.error(err);
        } finally {
            setLoadingUsers(false);
        }
    }, [getAccessTokenSilently]);

    useEffect(() => {
        if (isAuthenticated && isUserAdmin) {
            fetchUsers();
        }
    }, [isAuthenticated, isUserAdmin, fetchUsers]);

    const handleAddCredits = async (email: string) => {
        const amountStr = creditAmounts[email] || '0';
        const amount = parseInt(amountStr, 10);

        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid positive number of credits.");
            return;
        }

        setAddingCredits(prev => ({ ...prev, [email]: true }));
        try {
            const token = await getAccessTokenSilently();
            const result = await addCreditsToUser(token, email, amount);
            setUsers(prevUsers => prevUsers.map(u => u.email === email ? { ...u, credits: result.credits } : u));
            setCreditAmounts(prev => ({ ...prev, [email]: '' }));
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            alert(`Failed to add credits: ${message}`);
        } finally {
            setAddingCredits(prev => ({ ...prev, [email]: false }));
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center font-permanent-marker text-xl">Loading authentication...</div>;
    }

    if (!isAuthenticated) {
        return <div className="p-8 text-center font-permanent-marker text-xl">Please log in to view this page.</div>;
    }

    if (!isUserAdmin) {
        return (
            <div className="p-8 text-center font-permanent-marker text-xl text-red-600">
                You do not have permission to view this page.
                <br />
                <Link to="/" className="text-teal-600 hover:underline mt-4 inline-block">Go to Home</Link>
            </div>
        );
    }
    
    return (
        <main className="bg-[#FFF9E8] text-stone-800 min-h-screen w-full flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-caveat font-bold text-rainbow">Admin Panel</h1>
                    <p className="font-permanent-marker text-stone-600 mt-2 text-lg tracking-wide">User Credit Management</p>
                    <Link to="/" className="font-permanent-marker text-teal-600 hover:underline mt-4 inline-block">&larr; Back to RetroSnap</Link>
                </div>

                {loadingUsers && <div className="text-center font-permanent-marker animate-pulse">Loading users...</div>}
                {error && <div className="text-center font-sans text-red-600 bg-red-100 p-4 rounded-md">{error}</div>}
                
                {!loadingUsers && !error && (
                    <div className="bg-white/50 shadow-lg rounded-lg overflow-hidden border border-stone-200">
                        <table className="w-full text-left">
                            <thead className="bg-stone-100 border-b border-stone-200">
                                <tr>
                                    <th className="p-4 font-permanent-marker text-stone-600">User Email</th>
                                    <th className="p-4 font-permanent-marker text-stone-600 text-center">Credits</th>
                                    <th className="p-4 font-permanent-marker text-stone-600">Add Credits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.email} className="border-b border-stone-200 last:border-b-0 hover:bg-stone-50 transition-colors">
                                        <td className="p-4 align-middle font-sans text-stone-700">{user.email}</td>
                                        <td className="p-4 align-middle text-center font-bold font-permanent-marker text-2xl text-teal-600">{user.credits}</td>
                                        <td className="p-4 align-middle">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Amount"
                                                    value={creditAmounts[user.email] || ''}
                                                    onChange={(e) => setCreditAmounts(prev => ({...prev, [user.email]: e.target.value}))}
                                                    className="w-24 px-2 py-1 border border-stone-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                                                    disabled={addingCredits[user.email]}
                                                />
                                                <button
                                                    onClick={() => handleAddCredits(user.email)}
                                                    disabled={addingCredits[user.email] || !creditAmounts[user.email]}
                                                    className="font-permanent-marker text-sm text-center text-white bg-sky-600 py-1 px-3 rounded-sm transition-all duration-200 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {addingCredits[user.email] ? 'Adding...' : 'Add'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && (
                            <p className="text-center p-8 font-permanent-marker text-stone-500">No users found.</p>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
};

export default AdminPage;

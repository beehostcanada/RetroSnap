/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUserContext } from '../contexts/AuthContext';
import { getAllUsers } from '../services/geminiService';

interface UserData {
    id: string;
    email: string;
    credits: number;
    created_at: string;
    last_seen_at: string;
}

const AdminPage = () => {
    const { isAdmin, isLoading: isAuthLoading, getAccessTokenSilently } = useUserContext();
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            if (isAuthLoading) return; // Wait until authentication check is complete
            if (!isAdmin) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const token = await getAccessTokenSilently();
                const data = await getAllUsers(token);
                setUsers(data);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch user data.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [isAdmin, isAuthLoading, getAccessTokenSilently]);

    const renderContent = () => {
        if (isLoading || isAuthLoading) {
            return <p className="text-center text-slate-400 text-lg animate-pulse">Loading User Data...</p>;
        }

        if (!isAdmin) {
            // Redirect non-admins to the home page.
            return <Navigate to="/" replace />;
        }
        
        if (error) {
            return <p className="text-center text-red-400">{error}</p>;
        }

        if (users.length === 0) {
            return <p className="text-center text-slate-400">No users found in the database yet.</p>;
        }

        return (
            <div className="w-full max-w-5xl bg-[#1e293b]/50 border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="p-4 font-semibold text-slate-300">Email</th>
                                <th className="p-4 font-semibold text-slate-300 text-center">Credits</th>
                                <th className="p-4 font-semibold text-slate-300">Joined</th>
                                <th className="p-4 font-semibold text-slate-300">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="p-4 font-mono text-cyan-300 whitespace-nowrap">{user.email}</td>
                                    <td className="p-4 font-mono text-amber-300 text-center">{user.credits}</td>
                                    <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(user.created_at).toLocaleString()}</td>
                                    <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(user.last_seen_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <main className="bg-slate-900 text-slate-300 min-h-screen w-full flex flex-col items-center justify-center p-4">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
                <p className="text-slate-400">Overview of all registered users.</p>
            </div>
            {renderContent()}
            <div className="mt-8">
                <Link to="/" className="text-teal-400 hover:text-teal-300 transition-colors">← Back to Home</Link>
            </div>
        </main>
    );
};

export default AdminPage;
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserContext } from '../contexts/AuthContext';
import { getDebugInfo } from '../services/geminiService';

// Icons for status
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const XCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


interface DebugInfo {
    adminCheck: {
        envVarName: string;
        envVarValueMasked: string;
        userValueName: string;
        userValue: string;
        matched: boolean;
    };
}

const DebugPage = () => {
    const { isAuthenticated, isLoading: isAuthLoading, getAccessTokenSilently } = useUserContext();
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDebugData = async () => {
            if (!isAuthenticated) {
                // Wait for auth to finish, then if not authenticated, stop.
                if (!isAuthLoading) {
                    setIsLoading(false);
                }
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const token = await getAccessTokenSilently();
                const data = await getDebugInfo(token);
                setDebugInfo(data);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch debug information.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDebugData();
    }, [isAuthenticated, isAuthLoading, getAccessTokenSilently]);

    const renderContent = () => {
        if (isLoading || isAuthLoading) {
            return <p className="text-center text-slate-400 text-lg animate-pulse">Loading Debug Info...</p>;
        }

        if (error) {
            return <p className="text-center text-red-400">{error}</p>;
        }
        
        if (!isAuthenticated) {
             return (
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4 text-yellow-400">Authentication Required</h1>
                    <p className="text-slate-300">You must be logged in to view this page.</p>
                    <Link to="/" className="mt-6 inline-block text-teal-400 hover:text-teal-300 transition-colors">Go to Homepage to Log In</Link>
                </div>
            );
        }

        if (!debugInfo || !debugInfo.adminCheck) {
            return <p className="text-center text-slate-400">No debug information available or response is malformed.</p>;
        }

        const { adminCheck } = debugInfo;

        return (
            <div className="w-full max-w-4xl bg-[#1e293b]/50 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-800/50">
                        <tr>
                            <th className="p-4 font-semibold text-slate-300">Check</th>
                            <th className="p-4 font-semibold text-slate-300">Variable</th>
                            <th className="p-4 font-semibold text-slate-300">Value</th>
                            <th className="p-4 font-semibold text-slate-300 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-slate-700 align-top">
                            <td rowSpan={2} className="p-4 border-r border-slate-700">
                                <p className="font-bold text-white">Admin Access</p>
                                <p className="text-sm text-slate-400">Verifies if the logged-in user is the administrator.</p>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-400">{adminCheck.envVarName}</td>
                            <td className="p-4 font-mono text-amber-300">{adminCheck.envVarValueMasked}</td>
                             <td rowSpan={2} className="p-4 border-l border-slate-700 text-center">
                                {adminCheck.matched ? (
                                    <div className="flex flex-col items-center">
                                        <CheckCircleIcon />
                                        <span className="mt-1 text-sm font-semibold text-green-400">Matched</span>
                                    </div>
                                ) : (
                                     <div className="flex flex-col items-center">
                                        <XCircleIcon />
                                        <span className="mt-1 text-sm font-semibold text-red-400">Not Matched</span>
                                    </div>
                                )}
                            </td>
                        </tr>
                        <tr className="border-t border-slate-800">
                            <td className="p-4 text-sm text-slate-400">{adminCheck.userValueName}</td>
                            <td className="p-4 font-mono text-cyan-300">{adminCheck.userValue}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <main className="bg-slate-900 text-slate-300 min-h-screen w-full flex flex-col items-center justify-center p-4">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Application Debug Information</h1>
                <p className="text-slate-400">This page shows the status of critical configuration checks.</p>
            </div>
            {renderContent()}
             <div className="mt-8">
                <Link to="/" className="text-teal-400 hover:text-teal-300 transition-colors">← Back to Home</Link>
            </div>
        </main>
    );
};

export default DebugPage;
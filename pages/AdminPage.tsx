/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/AuthContext';


// --- SVG Icons ---
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
);


const AdminPage = () => {
    const { isAuthenticated, isLoading, isAdmin, error } = useUserContext();
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(true); // Keep the single item expanded by default

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !error) {
            navigate('/');
        }
    }, [isLoading, isAuthenticated, error, navigate]);
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center text-slate-400 text-lg animate-pulse">Verifying Session...</div>;
        }

        if (error) {
            return (
                <div className="text-center bg-red-900/50 border border-red-700 p-6 rounded-lg max-w-2xl">
                    <h1 className="text-3xl font-bold mb-4 text-red-400">Authentication Error</h1>
                    <p className="text-slate-300 mb-4">
                        The application could not verify your session. This often happens when the Auth0 'Audience' setting doesn't match the API identifier configured in your Auth0 dashboard.
                    </p>
                    <p className="text-slate-400 text-sm mb-6">
                        Please check the setup guide and ensure the Audience value in the code matches the Identifier for your API in Auth0.
                    </p>
                    <details className="text-left bg-slate-800 p-3 rounded">
                        <summary className="cursor-pointer text-slate-300">Technical Details</summary>
                        <pre className="text-xs text-slate-400 whitespace-pre-wrap mt-2">
                            {error.message || 'No additional details provided.'}
                        </pre>
                    </details>
                     <Link to="/" className="mt-6 inline-block text-teal-400 hover:text-teal-300 transition-colors">Go back to the homepage</Link>
                </div>
            );
        }
        
        if (!isAdmin) {
            return (
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4 text-red-400">Access Denied</h1>
                    <p className="text-slate-300">You are not authorized to view this page.</p>
                    <Link to="/" className="mt-6 text-teal-400 hover:text-teal-300 transition-colors">Go back to the homepage</Link>
                </div>
            );
        }

        return (
             <div className="w-full max-w-5xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Environment variables</h1>
                    <p className="text-slate-400">Securely store secrets, API keys, tokens, and other environment variables</p>
                    <a href="#" className="text-teal-400 hover:text-teal-300 flex items-center gap-1 mt-2 group">
                        Learn more about environment variables in the docs
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </a>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-[#1e293b]/50 border border-slate-700 rounded-lg">
                    <div className="relative w-full sm:w-auto sm:flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Filter by key name"
                            className="bg-slate-800 border border-slate-600 rounded-md w-full pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-md hover:bg-slate-700">
                            Any scope <ChevronDownIcon />
                        </button>
                        <button className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-md hover:bg-slate-700">
                            Any context <ChevronDownIcon />
                        </button>
                        <button className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-md hover:bg-slate-700">
                            Sort <ChevronDownIcon />
                        </button>
                    </div>
                </div>

                {/* Variable List */}
                <div className="bg-[#1e293b]/50 border border-slate-700 rounded-lg overflow-hidden">
                    {/* Variable Item Header */}
                    <div 
                        className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-expanded={isExpanded}
                    >
                        <div>
                            <p className="font-mono font-bold text-white">ADMIN_EMAIL</p>
                            <p className="text-sm text-slate-400">All scopes · Same value in all deploy contexts</p>
                        </div>
                        <ChevronDownIcon />
                    </div>

                    {/* Expanded Variable Form */}
                    {isExpanded && (
                        <div className="p-6 border-t border-slate-700 bg-slate-900/30">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">

                                {/* Key */}
                                <div className="md:col-span-1"><label htmlFor="key-input" className="block font-medium text-slate-300 pt-2">Key:</label></div>
                                <div className="md:col-span-2">
                                    <input id="key-input" type="text" defaultValue="ADMIN_EMAIL" className="bg-slate-800 border border-slate-600 rounded-md w-full px-4 py-2 font-mono text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"/>
                                </div>
                                
                                {/* Secret */}
                                <div className="md:col-span-1"><label className="block font-medium text-slate-300 pt-2">Secret:</label></div>
                                <div className="md:col-span-2">
                                    <label className="flex items-start cursor-pointer">
                                        <input type="checkbox" className="h-4 w-4 mt-1 bg-slate-700 border-slate-600 rounded text-teal-500 focus:ring-teal-500"/>
                                        <div className="ml-3">
                                            <span className="text-white">Contains secret values</span>
                                            <p className="text-sm text-slate-400 mt-1">
                                                Secret values are only readable by code running on Netlify's UI, and values are readable and unmasked on Netlify's UI.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                                
                                {/* Scopes */}
                                <div className="md:col-span-1"><label className="block font-medium text-slate-300 pt-2">Scopes:</label></div>
                                <div className="md:col-span-2 space-y-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="radio" name="scopes" value="all" defaultChecked className="h-4 w-4 text-teal-500 bg-slate-700 border-slate-600 focus:ring-teal-500 focus:ring-offset-slate-900"/>
                                        <span className="ml-3 text-white">All scopes</span>
                                    </label>
                                    <div>
                                        <label className="flex items-start cursor-not-allowed">
                                            <input type="radio" name="scopes" value="specific" disabled className="h-4 w-4 mt-1 bg-slate-800 border-slate-600"/>
                                            <div className="ml-3">
                                                <span className="text-slate-500">Specific scopes</span>
                                                <p className="text-sm text-slate-400 mt-1">Limit this environment variable to specific scopes.</p>
                                            </div>
                                        </label>
                                        <button className="mt-2 ml-7 bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center text-sm hover:bg-blue-500 transition-colors">
                                            <LockIcon />
                                            Upgrade to unlock
                                        </button>
                                    </div>
                                </div>

                                {/* Values */}
                                <div className="md:col-span-1"><label className="block font-medium text-slate-300 pt-2">Values:</label></div>
                                <div className="md:col-span-2 space-y-4">
                                    <div>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="radio" name="values" value="same" defaultChecked className="h-4 w-4 text-teal-500 bg-slate-700 border-slate-600 focus:ring-teal-500 focus:ring-offset-slate-900"/>
                                            <span className="ml-3 text-white">Same value for all deploy contexts</span>
                                        </label>
                                        <input id="value-input" type="text" defaultValue="ajbatac@gmail.com" className="bg-slate-800 border border-slate-600 rounded-md w-full px-4 py-2 font-mono ml-7 max-w-md mt-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"/>
                                    </div>
                                    <label className="flex items-center cursor-pointer">
                                        <input type="radio" name="values" value="different" className="h-4 w-4 bg-slate-700 border-slate-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900"/>
                                        <span className="ml-3 text-white">Different value for each deploy context</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    return (
        <main className="bg-slate-900 text-slate-300 min-h-screen w-full flex flex-col items-center justify-center p-4">
            {renderContent()}
        </main>
    );
};

export default AdminPage;
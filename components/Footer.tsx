/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Link } from 'react-router-dom';
import { useUserContext } from '../contexts/AuthContext';


const Footer = () => {
    const { user, isAuthenticated, isLoading, isUserDataLoading, isAdmin, logout } = useUserContext();
    
    // Only show the admin link when all loading is complete and the user is confirmed to be an admin.
    const showAdminLink = !isLoading && !isUserDataLoading && isAdmin;

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-sky-600 p-3 z-50 text-sky-100 text-xs sm:text-sm border-t border-sky-300">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center gap-4 px-4">
                {/* Left Side */}
                <div className="flex items-center gap-4 text-white-500 whitespace-nowrap">
                    {isAuthenticated && user && (
                        <div className="flex items-center gap-4">
                             <p className="hidden sm:block text-white-950 font-bold">{user.email}</p>
                             <button
                                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                className="font-bold text-white-700 hover:text-pink-500 transition-colors duration-200"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Side */}
                <div className="flex-grow flex justify-end items-center gap-4 sm:gap-6 text-white-500 whitespace-nowrap">
                    {showAdminLink && (
                        <>
                            <Link to="/admin" className="font-bold text-white-700 hover:text-pink-500 transition-colors duration-200">
                                Admin Panel
                            </Link>
                            <span className="text-sky-400" aria-hidden="true">|</span>
                        </>
                    )}
                    <p>
                        Original by{' '}
                        <a
                            href="https://x.com/ammaar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white-700 hover:text-white-500 transition-colors duration-200"
                        >
                            @ammaar
                        </a>
                    </p>
                    <span className="text-sky-400" aria-hidden="true">|</span>
                    <p>
                        Made more funner by{' '}
                        <a
                            href="https://ajbatac.github.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white-700 hover:text-pink-500 transition-colors duration-200"
                        >
                            @ajbatac
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
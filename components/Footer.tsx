/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Link } from 'react-router-dom';
import { useUserContext } from '../contexts/AuthContext';


const Footer = () => {
    const { user, isAuthenticated, isLoading, isAdmin, logout } = useUserContext();
    
    const showAdminLink = !isLoading && isAdmin;

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-pink-600 p-3 z-50 text-sky-100 text-xs sm:text-sm border-t border-sky-300">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center gap-4 px-4">
                {/* Left Side */}
                <div className="flex items-center gap-4 text-black-500 whitespace-nowrap">
                    {isAuthenticated && user && (
                        <div className="flex items-center gap-4">
                             <p className="hidden sm:block text-white-950 font-bold">{user.email}</p>
                             <button
                                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                className="font-bold text-white-700 hover:text-red-500 transition-colors duration-200"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Side */}
                <div className="flex-grow flex justify-end items-center gap-4 sm:gap-6 text-white-500 whitespace-nowrap">
                    {isAuthenticated && (
                         <>
                            {showAdminLink && (
                                <>
                                <Link to="/admin" className="font-bold text-black-700 hover:text-pink-500 transition-colors duration-200">
                                    Admin
                                </Link>
                                <span className="text-sky-400" aria-hidden="true">|</span>
                                </>
                            )}
                        </>
                    )}
                    <span className="text-sky-400" aria-hidden="true">|</span>
                    <p>
                        Made more fun by{' '}
                        <a
                            href="https://ajbatac.github.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white-700 hover:text-black-500 transition-colors duration-200"
                        >
                            @ajbatac
                        </a>
                    </p>
                    <p>
                        Original by @ammaar
                    </p>                    
                </div>
            </div>
        </footer>
    );
};

export default Footer;
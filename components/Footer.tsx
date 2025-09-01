/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REMIX_IDEAS = [
    "to try different hairstyles.",
    "to turn your pet into a cartoon character.",
    "to create a fantasy version of yourself.",
    "to design a superhero based on your photo.",
    "to place yourself in famous historical events.",
    "to generate a custom video game avatar.",
];

const Footer = () => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setIndex(prevIndex => (prevIndex + 1) % REMIX_IDEAS.length);
        }, 3500); // Change text every 3.5 seconds

        return () => clearInterval(intervalId);
    }, []);

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-sky-600 p-3 z-50 text-sky-800 text-xs sm:text-sm border-t border-sky-300">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center gap-4 px-4">
                {/* Left Side */}
                <div className="hidden md:flex items-center gap-4 text-white-500 whitespace-nowrap">
                    
                    <p>
                        Original by{' '}
                        <a
                            href="https://x.com/ammaar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-700 hover:text-pink-500 transition-colors duration-200"
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
                            className="text-sky-700 hover:text-pink-500 transition-colors duration-200"
                        >
                            @ajbatac 
                        </a>
                    </p>
                </div>

                {/* Right Side */}
                <div className="flex-grow flex justify-end items-center gap-4 sm:gap-6">
                    <div className="hidden lg:flex items-center gap-2 text-sky-950 text-right min-w-0">
                      
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                        
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
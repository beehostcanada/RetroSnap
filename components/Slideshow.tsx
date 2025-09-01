/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlideshowImage {
    url: string;
    caption: string;
}

interface SlideshowProps {
    images: SlideshowImage[];
    startIndex?: number;
    onClose: () => void;
    onDownload: (caption: string) => void;
}

const backdropVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
};

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0,
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0,
    }),
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
};

const Slideshow: React.FC<SlideshowProps> = ({ images, startIndex = 0, onClose, onDownload }) => {
    const [[page, direction], setPage] = useState([startIndex, 0]);

    const imageIndex = ((page % images.length) + images.length) % images.length;

    const paginate = (newDirection: number) => {
        setPage([page + newDirection, newDirection]);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                paginate(1);
            } else if (e.key === 'ArrowLeft') {
                paginate(-1);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [page]); 

    if (!images || images.length === 0) {
        return null;
    }
    
    const currentImage = images[imageIndex];

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#FFF9E8]/90 backdrop-blur-md flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Image slideshow"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-stone-700 text-4xl z-50 hover:text-stone-900 transition-colors"
                aria-label="Close slideshow"
            >
                &times;
            </button>

            <div
                className="relative w-full h-full flex flex-col items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="relative w-full max-w-3xl h-[70%] flex items-center justify-center overflow-hidden">
                    <AnimatePresence initial={false} custom={direction}>
                        <motion.img
                            key={page}
                            src={currentImage.url}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: 'spring', stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 },
                            }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragEnd={(e, { offset, velocity }) => {
                                const swipe = swipePower(offset.x, velocity.x);
                                if (swipe < -swipeConfidenceThreshold) {
                                    paginate(1);
                                } else if (swipe > swipeConfidenceThreshold) {
                                    paginate(-1);
                                }
                            }}
                            className="absolute max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                            alt={currentImage.caption}
                        />
                    </AnimatePresence>
                </div>

                <div className="text-center mt-4 text-stone-800 z-20">
                    <p className="font-permanent-marker text-3xl">{currentImage.caption}</p>
                    <button
                        onClick={() => onDownload(currentImage.caption)}
                        className="mt-2 text-teal-500 hover:text-teal-600 transition-colors text-lg font-permanent-marker"
                    >
                        Download This Photo
                    </button>
                </div>
            </div>

            <button
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 bg-black/10 p-2 rounded-full text-stone-800 hover:bg-black/20 transition-colors z-50"
                onClick={(e) => { e.stopPropagation(); paginate(-1); }}
                aria-label="Previous image"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 bg-black/10 p-2 rounded-full text-stone-800 hover:bg-black/20 transition-colors z-50"
                onClick={(e) => { e.stopPropagation(); paginate(1); }}
                aria-label="Next image"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </motion.div>
    );
};

export default Slideshow;
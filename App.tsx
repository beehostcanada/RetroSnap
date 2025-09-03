/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateStyledImage } from './services/geminiService';
import PolaroidCard from './components/PolaroidCard';
import { createAlbumPage } from './lib/albumUtils';
import Footer from './components/Footer';
import heic2any from 'heic2any';
import Slideshow from './components/Slideshow';
import { addWatermark } from './lib/utils';
import { useUserContext } from './contexts/AuthContext';


const DECADES = ['1900s', '1910s', '1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s'];
const INSPIRATION_PROMPTS = ["A vibrant cartoon", "A charcoal sketch", "8-bit pixel art", "Vaporwave aesthetic", "An oil painting", "A futuristic robot"];

const GHOST_POLAROIDS_CONFIG = [
  { initial: { x: "200%", y: "-150%", rotate: 15 }, transition: { delay: 0.1 } },
  { initial: { x: "-150%", y: "-100%", rotate: -30 }, transition: { delay: 0.2 } },
  { initial: { x: "160%", y: "160%", rotate: 35 }, transition: { delay: 0.25 } },
  { initial: { x: "100%", y: "150%", rotate: 10 }, transition: { delay: 0.3 } },
  { initial: { x: "150%", y: "-80%", rotate: 25 }, transition: { delay: 0.4 } },
  { initial: { x: "0%", y: "-200%", rotate: 0 }, transition: { delay: 0.5 } },
  { initial: { x: "-180%", y: "-120%", rotate: -50 }, transition: { delay: 0.55 } },
  { initial: { x: "-120%", y: "120%", rotate: 45 }, transition: { delay: 0.6 } },
  { initial: { x: "-50%", y: "-250%", rotate: -5 }, transition: { delay: 0.65 } },
  { initial: { x: "-200%", y: "150%", rotate: -10 }, transition: { delay: 0.7 } },
  { initial: { x: "180%", y: "90%", rotate: -20 }, transition: { delay: 0.8 } },
  { initial: { x: "0%", y: "250%", rotate: 5 }, transition: { delay: 0.9 } },
];


type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

const primaryButtonClasses = "font-permanent-marker text-xl text-center text-stone-900 bg-teal-400 py-3 px-8 rounded-sm transform transition-all duration-200 hover:scale-105 hover:-rotate-2 shadow-[3px_3px_0px_#fb923c] hover:shadow-[4px_4px_0px_#f97316] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:rotate-0 disabled:shadow-[3px_3px_0px_#fb923c]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-pink-500 bg-transparent border-2 border-pink-400 py-3 px-8 rounded-sm transform transition-all duration-200 hover:scale-105 hover:rotate-2 hover:bg-pink-400 hover:text-white";
const inspirationButtonClasses = "font-permanent-marker text-sm text-center text-orange-600 bg-orange-100 border border-orange-200 py-2 px-4 rounded-sm transition-all duration-200 hover:scale-105 hover:bg-orange-200";

const resizeImage = (imageDataUrl: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for resizing. It might be corrupted or in an unsupported format.'));
        };
        img.src = imageDataUrl;
    });
};

function App() {
    const { user, isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently, credits, fetchUserData } = useUserContext();
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<'idle' | 'image-uploaded' | 'generating' | 'results-shown'>('idle');
    const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
    const [slideshowOpen, setSlideshowOpen] = useState(false);
    const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);    
    const [customPrompt, setCustomPrompt] = useState('');
    const [paidForCurrentImage, setPaidForCurrentImage] = useState<boolean>(false);

    const getAuthToken = useCallback(async (): Promise<string> => {
        try {
            const token = await getAccessTokenSilently();
            if (!token) throw new Error("Could not retrieve access token.");
            return token;
        } catch (error) {
            console.error("Error getting access token", error);
            throw new Error("Authentication error: Could not get a token for the API. Please try logging in again.");
        }
    }, [getAccessTokenSilently]);

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        let file = e.target.files[0];
        e.target.value = '';

        setIsProcessingUpload(true);
        
        try {
            const isHeic = file.type.includes('heic') || file.type.includes('heif') || /\.(heic|heif)$/i.test(file.name);
            
            if (isHeic) {
                console.log("HEIC file detected. Converting to JPEG...");
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.9,
                }) as Blob | Blob[];

                const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                file = new File([finalBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result);
                    } else {
                        reject(new Error("FileReader did not return a string."));
                    }
                };
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });

            const resizedImage = await resizeImage(dataUrl, 1024, 1024);
            
            setUploadedImage(resizedImage);
            setAppState('image-uploaded');
            setGeneratedImages({});
            setPaidForCurrentImage(false); // Reset payment status for new image

        } catch (error) {
            console.error("Error processing image:", error);
            alert("There was a problem processing your image. It might be in an unsupported format. Please try a standard JPEG or PNG.");
            setAppState('idle');
        } finally {
            setIsProcessingUpload(false);
        }
    };
    
    const handleCreditDeduction = () => {
        if (!paidForCurrentImage) {
            fetchUserData(); // Refresh credits from the source of truth
            setPaidForCurrentImage(true);
        }
    }


    const handleGenerateTimeline = async () => {
        if (!uploadedImage) return;

        // Check if user has credits, unless they've already paid for this image.
        if (!paidForCurrentImage && credits !== null && credits <= 0) {
            alert("You are out of credits and cannot generate images from a new photo.");
            return;
        }

        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        DECADES.forEach(decade => {
            initialImages[decade] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);
        
        let atLeastOneSuccess = false;

        try {
            const token = await getAuthToken();
            for (const decade of DECADES) {
                try {
                    const prompt = `Change the style of this photograph to look like it was taken in the ${decade}. Adapt the clothing, hair, and photo quality to match the era, but keep the person's face recognizable.`;
                    const resultUrl = await generateStyledImage(uploadedImage, prompt, token);
                    const watermarkedUrl = await addWatermark(resultUrl);
                    setGeneratedImages(prev => ({
                        ...prev,
                        [decade]: { status: 'done', url: watermarkedUrl },
                    }));
                    atLeastOneSuccess = true;
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                    setGeneratedImages(prev => ({
                        ...prev,
                        [decade]: { status: 'error', error: errorMessage },
                    }));
                    console.error(`Failed to generate image for ${decade}:`, err);
                }
            }
        } catch(authError) {
             alert(authError instanceof Error ? authError.message : "An unknown authentication error occurred.");
             setAppState('image-uploaded');
             return;
        }

        // If at least one image was made, and we haven't charged for this upload yet, deduct a credit.
        if (atLeastOneSuccess) {
            handleCreditDeduction();
        }

        setAppState('results-shown');
    };

    const handleGenerateCustom = async () => {
        if (!uploadedImage || !customPrompt.trim()) return;

        // Check if user has credits, unless they've already paid for this image.
        if (!paidForCurrentImage && credits !== null && credits <= 0) {
            alert("You are out of credits and cannot generate images from a new photo.");
            return;
        }

        setAppState('generating');
        const prompt = customPrompt.trim();
        setGeneratedImages({ [prompt]: { status: 'pending' } });

        let wasSuccessful = false;
        try {
            const token = await getAuthToken();
            const fullPrompt = `Change the style of this photograph to look like: ${prompt}. Adapt the original photo to match the new style, but keep the person's face recognizable.`;
            const resultUrl = await generateStyledImage(uploadedImage, fullPrompt, token);
            const watermarkedUrl = await addWatermark(resultUrl);
            setGeneratedImages({ [prompt]: { status: 'done', url: watermarkedUrl } });
            wasSuccessful = true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setGeneratedImages({ [prompt]: { status: 'error', error: errorMessage } });
            console.error(`Failed to generate custom image for prompt "${prompt}":`, err);
        }

        // If the image was made, and we haven't charged for this upload yet, deduct a credit.
        if (wasSuccessful) {
            handleCreditDeduction();
        }

        setAppState('results-shown');
    };

    const handleRegenerate = async (prompt: string) => {
        if (!uploadedImage || generatedImages[prompt]?.status === 'pending') return;
        
        setGeneratedImages(prev => ({ ...prev, [prompt]: { status: 'pending' } }));

        try {
            const token = await getAuthToken();
            const fullPrompt = DECADES.includes(prompt) 
                ? `Change the style of this photograph to look like it was taken in the ${prompt}. Adapt the clothing, hair, and photo quality to match the era, but keep the person's face recognizable.`
                : `Change the style of this photograph to look like: ${prompt}. Adapt the original photo to match the new style, but keep the person's face recognizable.`;
            
            const resultUrl = await generateStyledImage(uploadedImage, fullPrompt, token);
            const watermarkedUrl = await addWatermark(resultUrl);
            setGeneratedImages(prev => ({ ...prev, [prompt]: { status: 'done', url: watermarkedUrl } }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
             if (errorMessage.includes("Authentication error") || errorMessage.includes("out of credits")) {
                alert(errorMessage);
            }
            setGeneratedImages(prev => ({ ...prev, [prompt]: { status: 'error', error: errorMessage } }));
            console.error(`Failed to regenerate image for prompt "${prompt}":`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
        setCustomPrompt('');
        setPaidForCurrentImage(false);
        fetchUserData(); // Refresh credits when starting over
    };

    const handleDownloadIndividualImage = (prompt: string) => {
        const image = generatedImages[prompt];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `retrosnap-${prompt.replace(/\s+/g, '-').toLowerCase()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadAlbum = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.keys(generatedImages)
                .filter(decade => generatedImages[decade].status === 'done' && !!generatedImages[decade].url)
                .reduce((acc, decade) => {
                    acc[decade] = generatedImages[decade].url!;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length === 0) {
                alert("No images were generated successfully. Cannot create an album.");
                return;
            }

            const albumDataUrl = await createAlbumPage(imageData);

            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'retrosnap-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Failed to create or download album:", error);
            alert("Sorry, there was an error creating your album. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const generatedKeys = Object.keys(generatedImages);
    const successfulImages = generatedKeys
        .map(key => ({
            caption: key,
            status: generatedImages[key]?.status,
            url: generatedImages[key]?.url,
        }))
        .filter(image => image.status === 'done' && image.url)
        .map(image => ({ url: image.url!, caption: image.caption }));

    const hasNoCredits = credits !== null && credits <= 0;
    const cannotGenerate = hasNoCredits && !paidForCurrentImage;

    return (
        <main className="bg-[#FFF9E8] text-stone-800 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-32 overflow-hidden relative">
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
                <div className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-caveat font-bold text-rainbow">RetroSnap</h1>
                    <p className="font-permanent-marker text-stone-600 mt-2 text-xl tracking-wide">Snap photos through the years and reminisce.</p>
                </div>

                {isLoading && (
                    <div className="font-permanent-marker text-stone-500 text-lg">Loading...</div>
                )}
                
                {!isLoading && !isAuthenticated && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-6 w-full"
                    >
                         <p className="font-permanent-marker text-stone-500 text-center max-w-sm text-lg">
                            Log in to start your journey through time and generate your own retro photo album.
                         </p>
                        <button onClick={() => loginWithRedirect()} className={primaryButtonClasses}>
                            Login
                        </button>
                    </motion.div>
                )}

                {isAuthenticated && appState === 'idle' && (
                     <div className="relative flex flex-col items-center justify-center w-full">
                        {GHOST_POLAROIDS_CONFIG.map((config, index) => (
                             <motion.div
                                key={index}
                                className="absolute w-80 h-[26rem] rounded-md p-4 bg-stone-500/20 blur-sm"
                                initial={config.initial}
                                animate={{
                                    x: "0%", y: "0%", rotate: (Math.random() - 0.5) * 20,
                                    scale: 0,
                                    opacity: 0,
                                }}
                                transition={{
                                    ...config.transition,
                                    ease: "circOut",
                                    duration: 2,
                                }}
                            />
                        ))}
                        <motion.div
                             initial={{ opacity: 0, scale: 0.8 }}
                             animate={{ opacity: 1, scale: 1 }}
                             transition={{ delay: 2, duration: 0.8, type: 'spring' }}
                             className="flex flex-col items-center"
                        >
                            {user?.name && (
                                <div className="text-center mb-4">
                                    <p className="font-permanent-marker text-stone-600 text-2xl" aria-live="polite">
                                        Welcome, {user.name.split(' ')[0]}!
                                    </p>
                                    {credits !== null ? (
                                        <p className="font-permanent-marker text-teal-600 text-lg">
                                            You have {credits} credit{credits === 1 ? '' : 's'} left.
                                        </p>
                                    ) : (
                                        <p className="font-permanent-marker text-stone-500 text-lg animate-pulse">Checking credits...</p>
                                    )}
                                </div>
                            )}
                            <label htmlFor="file-upload" className="cursor-pointer group transform hover:scale-105 transition-transform duration-300">
                                 <PolaroidCard 
                                     caption={isProcessingUpload ? "Processing..." : "Click to begin"}
                                     status={isProcessingUpload ? 'pending' : 'done'}
                                 />
                            </label>
                            <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/heic, image/heif" onChange={handleImageUpload} />
                            <p className="mt-8 font-permanent-marker text-stone-500 text-center max-w-xs text-lg">
                                Click the polaroid to upload your photo and start your journey through time.
                            </p>
                        </motion.div>
                    </div>
                )}

                {isAuthenticated && appState === 'image-uploaded' && uploadedImage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-8 w-full max-w-lg"
                    >
                         <PolaroidCard 
                            imageUrl={uploadedImage} 
                            caption="Your Photo" 
                            status="done"
                         />
                         <div className="w-full flex flex-col items-center gap-4">
                            <button onClick={handleGenerateTimeline} disabled={cannotGenerate} className={primaryButtonClasses}>
                                Generate Timeline
                            </button>
                            {cannotGenerate && (
                                <p className="text-red-600 font-permanent-marker -mt-2">
                                    You are out of credits!
                                </p>
                            )}

                            <div className="w-full text-center my-2">
                                <span className="font-permanent-marker text-stone-500 text-lg">OR</span>
                            </div>

                            <div className="w-full bg-stone-50/50 p-4 rounded-md border border-stone-200">
                                <p className="font-permanent-marker text-stone-600 text-center text-lg mb-3">Try a Custom Style</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="e.g., An oil painting, a futuristic robot..."
                                        className="w-full px-3 py-2 border border-stone-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                                    />
                                    <button onClick={handleGenerateCustom} disabled={!customPrompt.trim() || cannotGenerate} className={`${primaryButtonClasses} !text-base !py-2 !px-4`}>
                                        Go
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                    {INSPIRATION_PROMPTS.map(prompt => (
                                        <button key={prompt} onClick={() => setCustomPrompt(prompt)} className={inspirationButtonClasses}>
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                         </div>
                         <button onClick={handleReset} className={`${secondaryButtonClasses} mt-4`}>
                            Different Photo
                        </button>
                    </motion.div>
                )}

                {isAuthenticated && (appState === 'generating' || appState === 'results-shown') && (
                     <div className="w-full max-w-5xl flex flex-col items-center">
                        {generatedKeys.length > 1 ? (
                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
                                {DECADES.map((decade) => (
                                    <div key={decade} className="flex justify-center">
                                        <PolaroidCard
                                            caption={decade}
                                            status={generatedImages[decade]?.status || 'pending'}
                                            imageUrl={generatedImages[decade]?.url}
                                            error={generatedImages[decade]?.error}
                                            onRegenerate={handleRegenerate}
                                            onDownload={handleDownloadIndividualImage}
                                            onCardClick={
                                                generatedImages[decade]?.status === 'done' && generatedImages[decade]?.url ?
                                                () => {
                                                    const successfulIndex = successfulImages.findIndex(img => img.caption === decade);
                                                    if (successfulIndex > -1) {
                                                        setSlideshowStartIndex(successfulIndex);
                                                        setSlideshowOpen(true);
                                                    }
                                                } : undefined
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex justify-center p-4">
                                {generatedKeys.map((key) => (
                                    <PolaroidCard
                                        key={key}
                                        caption={key}
                                        status={generatedImages[key]?.status || 'pending'}
                                        imageUrl={generatedImages[key]?.url}
                                        error={generatedImages[key]?.error}
                                        onRegenerate={handleRegenerate}
                                        onDownload={handleDownloadIndividualImage}
                                    />
                                ))}
                            </div>
                        )}
                         <div className="h-20 mt-8 flex items-center justify-center">
                            {appState === 'results-shown' && (
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    {generatedKeys.length > 1 && (
                                        <button 
                                            onClick={handleDownloadAlbum} 
                                            disabled={isDownloading} 
                                            className={`${primaryButtonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {isDownloading ? 'Creating Album...' : 'Download Album'}
                                        </button>
                                    )}
                                     {successfulImages.length > 1 && (
                                        <button 
                                            onClick={() => {
                                                setSlideshowStartIndex(0);
                                                setSlideshowOpen(true);
                                            }} 
                                            className={secondaryButtonClasses}
                                        >
                                            Slideshow
                                        </button>
                                    )}
                                    <button onClick={handleReset} className={secondaryButtonClasses}>
                                        Start Over
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {slideshowOpen && successfulImages.length > 0 && (
                    <Slideshow
                        images={successfulImages}
                        startIndex={slideshowStartIndex}
                        onClose={() => setSlideshowOpen(false)}
                        onDownload={handleDownloadIndividualImage}
                    />
                )}
            </AnimatePresence>
            
            <Footer />
        </main>
    );
}

export default App;
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


/**
 * Adds a "RetroSnap" watermark to an image.
 * @param imageDataUrl The data URL of the image to watermark.
 * @returns A promise that resolves with the data URL of the watermarked image.
 */
export async function addWatermark(imageDataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context for watermarking.'));
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // 1. Draw the original image
            ctx.drawImage(img, 0, 0);

            // 2. Prepare watermark text style
            const padding = Math.max(15, canvas.width * 0.02);
            const fontSize = Math.max(18, canvas.width * 0.04);
            ctx.font = `bold ${fontSize}px 'Caveat', cursive`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            
            // Create a rainbow gradient matching the logo
            const textMetrics = ctx.measureText("RetroSnap");
            const gradient = ctx.createLinearGradient(
                canvas.width - padding - textMetrics.width, 
                0, 
                canvas.width - padding, 
                0
            );
            
            gradient.addColorStop(0, '#f87171');
            gradient.addColorStop(0.2, '#fb923c');
            gradient.addColorStop(0.4, '#facc15');
            gradient.addColorStop(0.6, '#4ade80');
            gradient.addColorStop(0.8, '#38bdf8');
            gradient.addColorStop(1, '#a78bfa');
            
            ctx.fillStyle = gradient;

            // 3. Add a subtle shadow for readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            // 4. Draw the watermark text
            const text = "RetroSnap";
            const x = canvas.width - padding;
            const y = canvas.height - padding;
            ctx.fillText(text, x, y);

            // 5. Return the new image as a high-quality JPEG data URL
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for watermarking.'));
        };

        img.src = imageDataUrl;
    });
}
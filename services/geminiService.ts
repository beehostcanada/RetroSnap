/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Minimal Type Definitions to avoid @google/genai runtime dependencies ---
interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface Content {
    parts: Part[];
}

interface Candidate {
    content: Content;
}

interface MinimalGenerateContentResponse {
    candidates?: Candidate[];
}


// --- Helper Functions ---

/**
 * Processes the API response, extracting the image or throwing an error if none is found.
 * @param response The response from the generateContent call.
 * @returns A data URL string for the generated image.
 */
function processApiResponse(response: MinimalGenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textPartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.text);
    const textResponse = textPartFromResponse?.text;
    
    console.error("API did not return an image. Full Response:", response);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * A wrapper for the Gemini API call that uses `fetch` directly.
 * Includes a timeout and retry mechanism.
 * @param imagePart The image part of the request payload.
 * @param textPart The text part of the request payload.
 * @param token The user's JWT for authentication.
 * @returns The GenerateContentResponse from the API.
 */
async function callApiWithFetchAndRetry(imagePart: object, textPart: object, token: string): Promise<MinimalGenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;
    const requestTimeout = 30000; // 30 seconds
    
    const proxyUrl = '/api-proxy/v1beta/models/gemini-2.5-flash-image-preview:generateContent';

    const body = {
        contents: [{ parts: [imagePart, textPart] }],
    };

    const bodyString = JSON.stringify(body);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Send the user's JWT for authentication with the Netlify function
                    'Authorization': `Bearer ${token}`,
                },
                body: bodyString,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const responseBodyText = await response.text();

            if (!response.ok) {
                let errorDetails = `Status code: ${response.status}`;
                try {
                    const errorJson = JSON.parse(responseBodyText);
                    errorDetails = (errorJson.error || errorJson.message || JSON.stringify(errorJson));
                } catch (e) {
                    errorDetails = `${errorDetails}, Body: ${responseBodyText}`;
                }

                // Handle specific, actionable errors first.
                if (response.status === 401) {
                    throw new Error("Authentication failed. Please log out and log back in.");
                }

                throw new Error(`API request failed: ${errorDetails}`);
            }
            
            const responseJson = JSON.parse(responseBodyText);
            return responseJson as MinimalGenerateContentResponse;

        } catch (error) {
            console.error(`Error on fetch (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const isNetworkError = error instanceof TypeError;
            const isServerError = errorMessage.includes('Status code: 5');

            if ((isTimeout || isNetworkError || isServerError) && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error("API call failed after all retries.");
}


/**
 * Generates a styled image from a source image and a prompt.
 * @param imageDataUrl A data URL string of the source image.
 * @param prompt The prompt to guide the image generation.
 * @param token The user's JWT for authentication.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateStyledImage(imageDataUrl: string, prompt: string, token: string): Promise<string> {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
    }
    const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };
    const textPart = { text: prompt };

    try {
        console.log(`Attempting generation for prompt: "${prompt}"`);
        const response = await callApiWithFetchAndRetry(imagePart, textPart, token);
        return processApiResponse(response);
    } catch (error) {
        console.error("An unrecoverable error occurred during image generation.", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
    }
}

/**
 * Fetches the current user's credit balance.
 * @param token The user's JWT for authentication.
 * @returns A promise that resolves to an object containing the credit count.
 */
export async function getUserCredits(token: string): Promise<{ credits: number }> {
    const response = await fetch('/api-proxy/credits', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to get credits: ${errorBody}`);
    }

    return response.json();
}


/**
 * Deducts one credit from the user's account.
 * @param token The user's JWT for authentication.
 * @returns A promise that resolves to an object with the new credit count.
 */
export async function deductUserCredit(token: string): Promise<{ credits: number }> {
    const response = await fetch('/api-proxy/credits', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const responseBodyText = await response.text();
    if (!response.ok) {
        let errorDetails = `Status code: ${response.status}`;
        try {
            const errorJson = JSON.parse(responseBodyText);
            errorDetails = (errorJson.error || errorJson.message || JSON.stringify(errorJson));
        } catch (e) {
            errorDetails = `${errorDetails}, Body: ${responseBodyText}`;
        }
        
        if (response.status === 402) {
            throw new Error("You are out of credits.");
        }
        
        throw new Error(`Failed to deduct credit: ${errorDetails}`);
    }

    return JSON.parse(responseBodyText);
}

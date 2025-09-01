/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- IMPORTANT SECURITY CONFIGURATION ---
// To protect your Gemini API key from abuse, you must set up a client secret.
// 1. Generate a strong, random string (e.g., using a password manager).
// 2. Replace the placeholder value below with your generated secret.
// 3. Go to your Netlify project > Site configuration > Build & deploy > Environment variables.
// 4. Add an environment variable named `CLIENT_SECRET` and set its value to the *same* secret string.
const CLIENT_SECRET = "sk-my-super-secret-retro-app-key-12345";


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

    // Correctly find the text part for the error message from the raw response
    const textPartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.text);
    const textResponse = textPartFromResponse?.text;
    
    console.error("API did not return an image. Full Response:", response);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * A wrapper for the Gemini API call that uses `fetch` directly to avoid stream-related errors.
 * Includes a timeout and retry mechanism.
 * @param imagePart The image part of the request payload.
 * @param textPart The text part of the request payload.
 * @returns The GenerateContentResponse from the API.
 */
async function callApiWithFetchAndRetry(imagePart: object, textPart: object): Promise<MinimalGenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;
    const requestTimeout = 30000; // 30 seconds
    
    // Use the relative path to the proxy, with the correct model for image editing.
    const proxyUrl = '/api-proxy/v1beta/models/gemini-2.5-flash-image-preview:generateContent';

    const body = {
        contents: [{ parts: [imagePart, textPart] }],
        // The `generationConfig` with `responseModalities` is not a standard REST API field
        // and was likely causing the 404 error with the preview model.
        // The model is specialized for image output and should infer the modality.
    };

    const bodyString = JSON.stringify(body);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (CLIENT_SECRET.startsWith("__REPLACE_ME")) {
                throw new Error("Client secret is not configured. Please edit services/geminiService.ts to set a secret key.");
            }
        
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Secret': CLIENT_SECRET,
                },
                body: bodyString,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Read the response body as text ONCE. This avoids the "body stream already read" error.
            const responseBodyText = await response.text();

            if (!response.ok) {
                let errorDetails = `Status code: ${response.status}`;
                try {
                    // Try to parse the text as JSON for a more structured error message.
                    const errorJson = JSON.parse(responseBodyText);
                    errorDetails = (errorJson.error || errorJson.message || JSON.stringify(errorJson));
                } catch (e) {
                    // If parsing fails, the error response wasn't JSON. Use the raw text.
                    errorDetails = `${errorDetails}, Body: ${responseBodyText}`;
                }
                throw new Error(`API request failed: ${errorDetails}`);
            }
            
            // If the response was OK, parse the text we already fetched.
            const responseJson = JSON.parse(responseBodyText);
            return responseJson as MinimalGenerateContentResponse;

        } catch (error) {
            console.error(`Error on fetch (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const isNetworkError = error instanceof TypeError; // fetch throws TypeError for network errors
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
 * Generates a decade-styled image from a source image and a prompt.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param prompt The prompt to guide the image generation.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateDecadeImage(imageDataUrl: string, prompt: string): Promise<string> {
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
        const response = await callApiWithFetchAndRetry(imagePart, textPart);
        return processApiResponse(response);
    } catch (error) {
        console.error("An unrecoverable error occurred during image generation.", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
    }
}
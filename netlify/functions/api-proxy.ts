/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // Ensure the API key is set in Netlify's environment variables
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API_KEY is not configured on the server." }),
        };
    }

    // Extract the path from the request URL (e.g., /v1beta/models/...)
    // The path is everything after '/api-proxy/'
    const path = event.path.replace('/api-proxy/', '');
    
    // Construct the full Gemini API URL
    const geminiUrl = `${GEMINI_API_BASE_URL}/${path}?key=${apiKey}`;

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Pass the original body from the frontend request to the Gemini API
            body: event.body,
        });

        const data = await response.json();

        // If the API returned an error, forward that information
        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return {
                statusCode: response.status,
                body: JSON.stringify(data),
            };
        }

        // Return the successful response from Gemini to the frontend
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error in proxy function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal error occurred while contacting the AI model." }),
        };
    }
};

export { handler };

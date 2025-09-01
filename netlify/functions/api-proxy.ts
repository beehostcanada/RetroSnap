/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent } from "@netlify/functions";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

const handler: Handler = async (event: HandlerEvent) => {
    const { AUTH0_DOMAIN, API_KEY } = process.env;

    // --- VALIDATE ENVIRONMENT ---
    if (!AUTH0_DOMAIN) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "AUTH0_DOMAIN is not configured on the server." }),
        };
    }
    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API_KEY is not configured on the server." }),
        };
    }
    // --- END VALIDATE ENVIRONMENT ---


    // --- AUTHENTICATION GATING using Auth0 /userinfo endpoint ---
    const authHeader = event.headers['authorization'];
    if (!authHeader) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        };
    }

    try {
        const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
            headers: {
                Authorization: authHeader,
            },
        });

        if (!userInfoResponse.ok) {
            const errorBody = await userInfoResponse.text();
            console.error("Auth0 user info validation failed:", errorBody);
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Invalid token." }),
            };
        }
    } catch (error) {
        console.error("Error validating token with Auth0:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal error occurred during authentication." }),
        };
    }
    // --- END AUTHENTICATION GATING ---

    const path = event.path.replace('/api-proxy/', '');
    const geminiUrl = `${GEMINI_API_BASE_URL}/${path}?key=${API_KEY}`;

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: event.body,
        });

        const responseBody = await response.text();

        if (!response.ok) {
            console.error(`Gemini API Error (Status: ${response.status}):`, responseBody);
            return {
                statusCode: response.status,
                headers: { 'Content-Type': response.headers.get('Content-Type') || 'text/plain' },
                body: responseBody,
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: responseBody,
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
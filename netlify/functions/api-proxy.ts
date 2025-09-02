/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const { AUTH0_DOMAIN, API_KEY, CONTEXT } = process.env;

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


    // --- AUTHENTICATION & USER IDENTIFICATION ---
    const authHeader = event.headers['authorization'];
    const isDevRequest = authHeader === 'Bearer dev-token';
    let userIdentifier: string | null = null;

    if (isDevRequest) {
        if (CONTEXT && CONTEXT !== 'dev') {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: `Unauthorized: Dev token is only allowed in dev environments, but CONTEXT is '${CONTEXT}'.` }),
            };
        }
        userIdentifier = 'dev@example.com';
    } else {
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: Missing Authorization header." }) };
        }

        try {
            const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
                headers: { Authorization: authHeader },
            });

            if (!userInfoResponse.ok) {
                const errorBody = await userInfoResponse.text();
                console.error("Auth0 user info validation failed:", errorBody);
                return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: Invalid token." }) };
            }
            
            const userInfo = await userInfoResponse.json();
            // Use email as the unique identifier for the credit system
            if (!userInfo || typeof userInfo.email !== 'string') {
                 return { statusCode: 400, body: JSON.stringify({ error: "User email not found in token." }) };
            }
            userIdentifier = userInfo.email;

        } catch (error) {
            console.error("Error validating token with Auth0:", error);
            return { statusCode: 500, body: JSON.stringify({ error: "An internal error occurred during authentication." }) };
        }
    }
    // --- END AUTHENTICATION ---

    if (!userIdentifier) {
        return { statusCode: 401, body: JSON.stringify({ error: "Could not identify user." }) };
    }

    const creditsStore = (context as any).netlify.kvStore("credits");
    const requestPath = event.path.replace('/api-proxy/', '');

    // --- ENDPOINT ROUTING ---

    // Handle GET and POST requests to the /credits endpoint
    if (requestPath === 'credits') {
        if (event.httpMethod === 'GET') {
            let credits = await creditsStore.get(userIdentifier);
            if (credits === null) {
                await creditsStore.set(userIdentifier, 3);
                credits = 3;
            }
            return { statusCode: 200, body: JSON.stringify({ credits: Number(credits) }) };
        }

        if (event.httpMethod === 'POST') {
            if (isDevRequest) {
                return { statusCode: 200, body: JSON.stringify({ credits: 999 }) }; // Dev user has "infinite" credits
            }
            let credits = await creditsStore.get(userIdentifier);
            if (credits === null) {
                await creditsStore.set(userIdentifier, 2); // First-time use, 1 of 3 initial credits used.
                return { statusCode: 200, body: JSON.stringify({ credits: 2 }) };
            }
            const numericCredits = Number(credits);
            if (numericCredits <= 0) {
                return { statusCode: 402, body: JSON.stringify({ error: "You are out of credits." }) }; // 402 Payment Required
            }
            const newCredits = numericCredits - 1;
            await creditsStore.set(userIdentifier, newCredits);
            return { statusCode: 200, body: JSON.stringify({ credits: newCredits }) };
        }

        // Return Method Not Allowed for other methods on /credits
        return { statusCode: 405, body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed on /credits` }) };
    }

    // --- DEFAULT: PROXY TO GEMINI API ---
    // All other POST requests are proxied to the Gemini API.
    if (event.httpMethod === 'POST') {
        const geminiUrl = `${GEMINI_API_BASE_URL}/${requestPath}?key=${API_KEY}`;
        try {
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
                body: responseBody,
            };
        } catch (error) {
            console.error("Error in proxy function:", error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "An internal error occurred while contacting the AI model." }),
            };
        }
    }

    // Fallback for any other unhandled paths or methods
    return {
        statusCode: 404,
        body: JSON.stringify({ error: "Not Found" }),
    };
};

export { handler };

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
const INITIAL_CREDITS = 10;

// --- Helper Functions ---
const jsonResponse = (statusCode: number, body: object) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

// A simple email masking function for safe logging.
const maskEmail = (email?: string): string => {
    if (!email || !email.includes('@')) return 'invalid-or-missing-email';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) return `***@${domain}`;
    return `${localPart.substring(0, 2)}...${localPart.slice(-1)}@${domain}`;
};

interface AuthenticatedUser {
    email: string;
    id: string; // The Auth0 `sub` identifier
}

const handler: Handler = async (event: HandlerEvent) => {
    const { AUTH0_DOMAIN, API_KEY, CONTEXT, ADMIN_EMAIL } = process.env;

    // --- VALIDATE ENVIRONMENT ---
    if (!AUTH0_DOMAIN || !API_KEY || !ADMIN_EMAIL) {
        return jsonResponse(500, { error: "Server is not configured correctly. Missing required environment variables." });
    }
    // --- END VALIDATE ENVIRONMENT ---


    // --- AUTHENTICATION & USER IDENTIFICATION ---
    let user: AuthenticatedUser;
    const authHeader = event.headers['authorization'];
    const isDevRequest = authHeader === 'Bearer dev-token' && CONTEXT === 'dev';

    if (isDevRequest) {
        user = { email: 'dev@example.com', id: 'auth0|dev-user-12345' };
    } else {
        if (!authHeader) {
            return jsonResponse(401, { error: "Unauthorized: Missing Authorization header." });
        }
        try {
            const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
                headers: { Authorization: authHeader },
            });
            if (!userInfoResponse.ok) {
                return jsonResponse(401, { error: "Unauthorized: Invalid token." });
            }
            const userInfo = await userInfoResponse.json();
            if (!userInfo || typeof userInfo.email !== 'string' || typeof userInfo.sub !== 'string') {
                return jsonResponse(400, { error: "User email or ID not found in token." });
            }
            user = { email: userInfo.email, id: userInfo.sub };
        } catch (error) {
            console.error("Error validating token with Auth0:", error);
            return jsonResponse(500, { error: "An internal error occurred during authentication.", details: getErrorMessage(error) });
        }
    }
    // --- END AUTHENTICATION ---
    
    // --- API ROUTER ---
    const requestPath = event.path.replace('/api-proxy', '');
    
    const isAdmin = user && ADMIN_EMAIL && user.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

    console.log(`[AUTH_CHECK] Path: ${requestPath} | User: ${maskEmail(user.email)} | IsAdmin: ${isAdmin}`);


    // --- DEBUG ROUTE ---
    if (requestPath === '/debug-info' && event.httpMethod === 'GET') {
        try {
            const adminEmailEnv = ADMIN_EMAIL || ''; 
            const match = adminEmailEnv.trim().toLowerCase() === user.email.trim().toLowerCase();
            
            const debugInfo = {
                adminCheck: {
                    envVarName: "ADMIN_EMAIL",
                    envVarValueMasked: maskEmail(adminEmailEnv),
                    userValueName: "Authenticated User Email",
                    userValue: user.email,
                    matched: match,
                }
            };

            return jsonResponse(200, debugInfo);
        } catch (error) {
            console.error("Error generating debug info:", error);
            return jsonResponse(500, { error: "Failed to generate debug information.", details: getErrorMessage(error) });
        }
    }


    // --- USER DATA ROUTE (credits and admin status) ---
    if (requestPath === '/user-data' && event.httpMethod === 'GET') {
        const creditsStore = getStore('retrosnap_credits');
        try {
            const creditsStr = await creditsStore.get(user.id);
            let credits: number;

            if (creditsStr === undefined) {
                // This is a new user, grant initial credits.
                credits = INITIAL_CREDITS;
                await creditsStore.set(user.id, String(credits));
                console.log(`Initialized credits for new user ${maskEmail(user.email)}.`);
            } else {
                credits = parseInt(creditsStr, 10);
            }
            return jsonResponse(200, { isAdmin, credits });
        } catch (error) {
            console.error(`Error fetching credits for user ${maskEmail(user.email)}:`, error);
            return jsonResponse(500, { error: "Failed to retrieve user credit data.", details: getErrorMessage(error) });
        }
    }

    // --- PROXY TO GEMINI API ---
    if (event.httpMethod === 'POST' && requestPath.includes(':generateContent')) {
        const creditsStore = getStore('retrosnap_credits');
        try {
            const creditsStr = await creditsStore.get(user.id);
            const credits = parseInt(creditsStr || '0', 10);

            if (credits <= 0) {
                console.log(`Request blocked for user ${maskEmail(user.email)}: Out of credits.`);
                return jsonResponse(402, { error: "You are out of credits." });
            }

            // Deduct credit *before* the expensive API call.
            await creditsStore.set(user.id, String(credits - 1));
            console.log(`Credit deducted for ${maskEmail(user.email)}. New balance: ${credits - 1}`);
            
            // Proceed to proxy the request to the Gemini API
            const geminiUrl = `${GEMINI_API_BASE_URL}/${requestPath.replace('/v1beta/models/', 'v1beta/models/')}?key=${API_KEY}`;
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: event.body,
            });

            const responseBody = await geminiResponse.text();

            if (!geminiResponse.ok) {
                console.error(`Gemini API Error (Status: ${geminiResponse.status}):`, responseBody);
                // Note: We do not refund the credit on API failure to keep the logic simple.
                // This prevents abuse and handles cases where failure is due to a bad user prompt.
                return { statusCode: geminiResponse.status, body: responseBody };
            }

            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: responseBody };

        } catch (error) {
            console.error("Error in Gemini proxy:", error);
            return jsonResponse(500, { error: "An internal error occurred while contacting the AI model.", details: getErrorMessage(error) });
        }
    }

    return jsonResponse(404, { error: `Not Found. The path '${requestPath}' is not handled.` });
};

export { handler };
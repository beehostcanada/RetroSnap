/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

// IMPORTANT: Replace with your admin user's email address(es).
// Only these users will be able to access the admin endpoints.
const ADMIN_USERS = ['ajbatac@gmail.com'];

/**
 * Retrieves a user's credits from the KV store. If the user doesn't exist or
 * the data is invalid, it initializes them with 3 credits.
 * @param store The Netlify KV store instance.
 * @param userId The unique identifier for the user.
 * @returns A promise that resolves to the user's credit balance.
 */
async function getOrCreateUserCredits(store: any, userId: string): Promise<number> {
    const storedValue = await store.get(userId);

    // Case 1: New user. The store returns null for a non-existent key.
    if (storedValue === null) {
        await store.set(userId, 3);
        return 3;
    }

    // Case 2: Existing user or potentially corrupted data.
    // We use parseInt which handles numbers and numeric strings, but returns NaN for other types.
    const credits = parseInt(storedValue as any, 10);

    // If parsing results in NaN (e.g., from "abc", an empty object, etc.), the data
    // is considered invalid. In this case, we reset the user's credits.
    if (isNaN(credits)) {
        await store.set(userId, 3);
        return 3;
    }
    
    // The value is a valid number.
    return credits;
}


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
        userIdentifier = 'admin@example.com'; // Use admin for dev token
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

    const requestPath = event.path.replace('/api-proxy/', '');
    const isAdmin = userIdentifier && ADMIN_USERS.includes(userIdentifier);

    // --- ADMIN ENDPOINT ROUTING ---
    if (requestPath.startsWith('admin/')) {
        if (!isAdmin) {
            return { statusCode: 403, body: JSON.stringify({ error: "Forbidden: Admin access required." }) };
        }

        try {
            const creditsStore = (context as any).netlify?.kvStore?.("credits");
            if (!creditsStore) {
                throw new Error("KV Store not available in this environment.");
            }
            
            // GET /admin/users - List all users and their credits
            if (requestPath === 'admin/users' && event.httpMethod === 'GET') {
                const listResult = await creditsStore.list();
                const keys = listResult?.keys || []; // Safely access keys

                const users = await Promise.all(
                    keys.map(async ({ name }: { name: string }) => {
                        const credits = await creditsStore.get(name);
                        // Safely parse credits, defaulting to 0 if invalid.
                        return { email: name, credits: parseInt(credits as any, 10) || 0 };
                    })
                );
                users.sort((a, b) => a.email.localeCompare(b.email)); // Sort alphabetically
                return { statusCode: 200, body: JSON.stringify(users) };
            }
            
            // POST /admin/users/add-credits - Add credits to a user
            if (requestPath === 'admin/users/add-credits' && event.httpMethod === 'POST') {
                if (!event.body) {
                    return { statusCode: 400, body: JSON.stringify({ error: "Request body is missing." }) };
                }

                const { email, amount } = JSON.parse(event.body);
                if (!email || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
                    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request. 'email' and a positive integer 'amount' are required." }) };
                }
                
                const currentCredits = await getOrCreateUserCredits(creditsStore, email);
                const newCredits = currentCredits + amount;
                await creditsStore.set(email, newCredits);
                
                return { statusCode: 200, body: JSON.stringify({ credits: newCredits }) };
            }

            return { statusCode: 404, body: JSON.stringify({ error: "Admin route not found." }) };
        } catch (kvError) {
            console.error("Error with KV Store for admin action:", kvError);
            
            const isStoreUnavailable = kvError instanceof Error && kvError.message.includes("KV Store not available");

            // Only fall back to mock data if the store is explicitly unavailable (local dev without Netlify CLI).
            if (isStoreUnavailable) {
                console.warn("KV Store unavailable. Assuming local dev mode and returning mock data for admin panel.");

                if (requestPath === 'admin/users' && event.httpMethod === 'GET') {
                    const mockUsers = [
                        { email: 'user1@example.com', credits: 5 },
                        { email: 'user2@example.com', credits: 1 },
                        { email: 'admin@example.com', credits: 999 },
                    ];
                    return { statusCode: 200, body: JSON.stringify(mockUsers) };
                }

                if (requestPath === 'admin/users/add-credits' && event.httpMethod === 'POST') {
                    if (!event.body) {
                        return { statusCode: 400, body: JSON.stringify({ error: "Request body is missing." }) };
                    }
                    try {
                        const { email } = JSON.parse(event.body);
                        console.log(`Mock-adding credits to ${email}.`);
                        return { statusCode: 200, body: JSON.stringify({ credits: 10 }) };
                    } catch (parseError) {
                        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON in request body." }) };
                    }
                }
            }
            
            // For all other errors (likely on the live site), return a specific server error.
            const errorMessage = kvError instanceof Error ? kvError.message : "An unknown KV store error occurred.";
            return { statusCode: 500, body: JSON.stringify({ error: `Database error: ${errorMessage}` }) };
        }
    }


    // --- REGULAR USER ENDPOINT ROUTING ---

    // Handle GET and POST requests to the /credits endpoint
    if (requestPath === 'credits') {
        try {
            const creditsStore = (context as any).netlify?.kvStore?.("credits");
            if (!creditsStore) {
                throw new Error("KV Store not available in this environment.");
            }

            if (event.httpMethod === 'GET') {
                if (isDevRequest) {
                    return { statusCode: 200, body: JSON.stringify({ credits: 999 }) };
                }
                const credits = await getOrCreateUserCredits(creditsStore, userIdentifier);
                return { statusCode: 200, body: JSON.stringify({ credits }) };
            }

            if (event.httpMethod === 'POST') {
                if (isDevRequest) {
                    return { statusCode: 200, body: JSON.stringify({ credits: 999 }) }; // Dev user has "infinite" credits
                }
                
                const currentCredits = await getOrCreateUserCredits(creditsStore, userIdentifier);

                if (currentCredits <= 0) {
                    return { statusCode: 402, body: JSON.stringify({ error: "You are out of credits." }) }; // 402 Payment Required
                }

                const newCredits = currentCredits - 1;
                await creditsStore.set(userIdentifier, newCredits);
                return { statusCode: 200, body: JSON.stringify({ credits: newCredits }) };
            }

            // Return Method Not Allowed for other methods on /credits
            return { statusCode: 405, body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed on /credits` }) };
        } catch (kvError) {
             console.error("Error with KV Store for credits:", kvError);
             // Graceful fallback: If KV store fails, assume it's a local dev environment
             // without Netlify CLI. Grant mock credits to avoid blocking development.
             console.warn("Assuming local dev mode and granting mock credits due to KV store error.");
             if (event.httpMethod === 'GET') {
                return { statusCode: 200, body: JSON.stringify({ credits: 3 }) };
             }
             if (event.httpMethod === 'POST') {
                // Pretend the credit was deducted successfully from a starting balance of 3.
                return { statusCode: 200, body: JSON.stringify({ credits: 2 }) };
             }
             return { statusCode: 500, body: JSON.stringify({ error: "An error occurred with the credit system." }) };
        }
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
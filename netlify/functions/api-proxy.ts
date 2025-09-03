/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
// FIX: Import `FieldValue` to use for atomic server-side operations.
import { Firestore, FieldValue } from '@google-cloud/firestore';

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
const INITIAL_CREDITS = 3;

// --- Firestore Client Initialization ---
let firestore: Firestore | null = null;
const initializeFirestore = () => {
    if (firestore) {
        return;
    }
    const { GCP_PROJECT_ID, GCP_PRIVATE_KEY, GCP_CLIENT_EMAIL } = process.env;
    if (!GCP_PROJECT_ID || !GCP_PRIVATE_KEY || !GCP_CLIENT_EMAIL) {
        throw new Error("Missing required GCP environment variables for Firestore connection.");
    }
    firestore = new Firestore({
        projectId: GCP_PROJECT_ID,
        credentials: {
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'), // Important for Netlify env vars
            client_email: GCP_CLIENT_EMAIL,
        },
    });
};

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


const getDbUser = async (email: string) => {
    if (!firestore) throw new Error("Firestore not initialized.");
    const userRef = firestore.collection('users').doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        // Create user with initial credits
        const newUser = { email, credits: INITIAL_CREDITS };
        await userRef.set(newUser);
        return newUser;
    }
    return userDoc.data();
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const { AUTH0_DOMAIN, API_KEY, CONTEXT, ADMIN_EMAIL } = process.env;

    // --- VALIDATE ENVIRONMENT ---
    if (!AUTH0_DOMAIN || !API_KEY || !ADMIN_EMAIL) {
        return jsonResponse(500, { error: "Server is not configured correctly. Missing required environment variables." });
    }
    try {
        initializeFirestore();
    } catch (error) {
        console.error("Firestore Initialization Error:", error);
        return jsonResponse(500, { error: "Could not connect to the database.", details: getErrorMessage(error) });
    }
    // --- END VALIDATE ENVIRONMENT ---


    // --- AUTHENTICATION & USER IDENTIFICATION ---
    let userEmail: string | null = null;
    const authHeader = event.headers['authorization'];
    const isDevRequest = authHeader === 'Bearer dev-token' && CONTEXT === 'dev';

    if (isDevRequest) {
        userEmail = 'dev@example.com';
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
            if (!userInfo || typeof userInfo.email !== 'string') {
                return jsonResponse(400, { error: "User email not found in token." });
            }
            userEmail = userInfo.email;
        } catch (error) {
            console.error("Error validating token with Auth0:", error);
            return jsonResponse(500, { error: "An internal error occurred during authentication.", details: getErrorMessage(error) });
        }
    }

    if (!userEmail) {
        return jsonResponse(401, { error: "Could not identify user." });
    }
    // --- END AUTHENTICATION ---
    
    // --- API ROUTER ---
    const requestPath = event.path.replace('/api-proxy', '');
    
    // Trim whitespace and compare emails case-insensitively for robustness.
    const isAdmin = ADMIN_EMAIL && userEmail.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

    // Log the authorization check details for easier debugging in production.
    console.log(`[AUTH_CHECK] Path: ${requestPath} | Admin Email (env): ${maskEmail(ADMIN_EMAIL)} | User Email (auth): ${maskEmail(userEmail)} | IsAdmin: ${isAdmin}`);


    // --- USER ROUTES ---
    if (requestPath === '/credits' && event.httpMethod === 'GET') {
        try {
            const user = await getDbUser(userEmail);
            return jsonResponse(200, { credits: user?.credits ?? 0, isAdmin });
        } catch (error) {
            console.error("Error getting user credits:", error);
            return jsonResponse(500, { error: "Failed to retrieve user credits.", details: getErrorMessage(error) });
        }
    }

    // --- ADMIN ROUTES ---
    if (requestPath.startsWith('/admin')) {
        if (!isAdmin) {
            return jsonResponse(403, { error: "Forbidden: Admin access required." });
        }

        if (requestPath === '/admin/users' && event.httpMethod === 'GET') {
            try {
                if (!firestore) throw new Error("Firestore not initialized.");
                const usersSnapshot = await firestore.collection('users').get();
                const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return jsonResponse(200, users);
            } catch (error) {
                console.error("Error fetching all users:", error);
                return jsonResponse(500, { error: "Failed to fetch users.", details: getErrorMessage(error) });
            }
        }
        if (requestPath === '/admin/credits' && event.httpMethod === 'POST') {
            try {
                if (!firestore) throw new Error("Firestore not initialized.");
                const { email, credits } = JSON.parse(event.body || '{}');
                if (!email || typeof credits !== 'number' || credits < 0) {
                    return jsonResponse(400, { error: "Invalid request. 'email' and 'credits' (non-negative number) are required." });
                }
                await firestore.collection('users').doc(email).set({ credits }, { merge: true });
                return jsonResponse(200, { success: true, message: `Credits for ${email} updated to ${credits}.` });
            } catch (error) {
                console.error("Error updating user credits:", error);
                return jsonResponse(500, { error: "Failed to update credits.", details: getErrorMessage(error) });
            }
        }
    }

    // --- PROXY TO GEMINI API ---
    if (event.httpMethod === 'POST' && requestPath.includes(':generateContent')) {
        try {
            // Credit Check
            const user = await getDbUser(userEmail);
            if (!user || user.credits <= 0) {
                return jsonResponse(402, { error: "You are out of credits." }); // 402 Payment Required
            }

            const geminiUrl = `${GEMINI_API_BASE_URL}/${requestPath.replace('/v1beta/models/', 'v1beta/models/')}?key=${API_KEY}`;
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: event.body,
            });

            const responseBody = await geminiResponse.text();

            if (!geminiResponse.ok) {
                console.error(`Gemini API Error (Status: ${geminiResponse.status}):`, responseBody);
                return { statusCode: geminiResponse.status, body: responseBody };
            }

            // Deduct credit on success
            if (!firestore) throw new Error("Firestore not initialized.");
            await firestore.collection('users').doc(userEmail).update({
                // FIX: Use `FieldValue.increment` for atomic updates. `FieldValue` is not a static property of `Firestore`.
                credits: FieldValue.increment(-1)
            });

            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: responseBody };

        } catch (error) {
            console.error("Error in Gemini proxy:", error);
            return jsonResponse(500, { error: "An internal error occurred while contacting the AI model.", details: getErrorMessage(error) });
        }
    }

    return jsonResponse(404, { error: `Not Found. The path '${requestPath}' is not handled.` });
};

export { handler };
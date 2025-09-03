/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Handler, HandlerEvent } from "@netlify/functions";
import { Pool } from 'pg';

// --- Environment Variables and Constants ---
const { AUTH0_DOMAIN, API_KEY, CONTEXT, ADMIN_EMAIL } = process.env;
// Prioritize the Netlify-specific variable, but fall back to the generic one for wider compatibility.
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
const INITIAL_CREDITS = 10;

// --- Database Pool Setup ---
let pool: Pool;
// Use a secure connection to Neon by default. In local dev, you might need to adjust this.
if (DATABASE_URL) {
    pool = new Pool({
        connectionString: DATABASE_URL,
        // The `sslmode=require` parameter in the DATABASE_URL provided by Netlify's Neon
        // integration is sufficient for node-postgres to establish a secure connection.
        // Explicitly setting `ssl: { rejectUnauthorized: false }` is not best practice.
    });
}

// --- Database Initialization ---
// This promise ensures the 'users' table exists before any requests are handled.
const dbInit = pool ? (async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                credits INTEGER NOT NULL DEFAULT ${INITIAL_CREDITS},
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database table 'users' is ready.");
    } catch (err) {
        console.error("FATAL: Failed to initialize database table:", err);
        // This will cause subsequent requests to fail, which is intended if the DB is not ready.
        throw err;
    }
})() : Promise.reject("Neither NETLIFY_DATABASE_URL nor DATABASE_URL environment variable is set.");


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
    // --- Environment Validation ---
    if (!pool || !DATABASE_URL || !AUTH0_DOMAIN || !API_KEY || !ADMIN_EMAIL) {
        console.error("FATAL: Server is not configured correctly. Missing one or more required environment variables.");
        return jsonResponse(500, { error: "Server configuration error." });
    }

    // --- Authentication & User Identification ---
    let user: AuthenticatedUser;
    const authHeader = event.headers['authorization'];
    const isDevRequest = authHeader === 'Bearer dev-token' && CONTEXT === 'dev';

    if (isDevRequest) {
        user = { email: 'dev@example.com', id: 'auth0|dev-user-12345' };
    } else {
        if (!authHeader) return jsonResponse(401, { error: "Unauthorized: Missing Authorization header." });
        try {
            const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, { headers: { Authorization: authHeader } });
            if (!userInfoResponse.ok) return jsonResponse(401, { error: "Unauthorized: Invalid token." });
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
    
    // --- API ROUTER ---
    const requestPath = event.path.replace('/api-proxy', '');
    const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    console.log(`[REQUEST] Path: ${requestPath} | User: ${maskEmail(user.email)} | IsAdmin: ${isAdmin}`);
    
    await dbInit; // Ensure the database table is ready before proceeding.

    // --- USER DATA ROUTE (/user-data) ---
    if (requestPath === '/user-data' && event.httpMethod === 'GET') {
        const client = await pool.connect();
        try {
            // Upsert logic: Update if user exists, otherwise insert a new record.
            const findUserQuery = `SELECT credits FROM users WHERE id = $1`;
            let userResult = await client.query(findUserQuery, [user.id]);
            
            let credits: number;
            if (userResult.rowCount > 0) {
                // User exists, update last_seen and email
                credits = userResult.rows[0].credits;
                await client.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP, email = $2 WHERE id = $1', [user.id, user.email]);
            } else {
                // New user, insert with initial credits
                const insertQuery = `INSERT INTO users (id, email, credits) VALUES ($1, $2, $3) RETURNING credits`;
                const insertResult = await client.query(insertQuery, [user.id, user.email, INITIAL_CREDITS]);
                credits = insertResult.rows[0].credits;
                console.log(`Created new user record for ${maskEmail(user.email)}`);
            }
            return jsonResponse(200, { isAdmin, credits });
        } catch (error) {
            console.error(`Error in /user-data for ${maskEmail(user.email)}:`, error);
            return jsonResponse(500, { error: "Failed to retrieve user data.", details: getErrorMessage(error) });
        } finally {
            client.release();
        }
    }

    // --- ADMIN USER LIST ROUTE (/admin/users) ---
    if (requestPath === '/admin/users' && event.httpMethod === 'GET') {
        if (!isAdmin) return jsonResponse(403, { error: "Forbidden: Access restricted to administrators." });
        try {
            const result = await pool.query('SELECT id, email, credits, created_at, last_seen_at FROM users ORDER BY last_seen_at DESC');
            return jsonResponse(200, result.rows);
        } catch (error) {
            console.error("Error fetching all users for admin:", error);
            return jsonResponse(500, { error: "Failed to retrieve user list.", details: getErrorMessage(error) });
        }
    }
    
    // --- DEBUG ROUTE (/debug-info) ---
    if (requestPath === '/debug-info' && event.httpMethod === 'GET') {
        const adminEmailEnv = ADMIN_EMAIL || '';
        const debugInfo = { adminCheck: {
            envVarName: "ADMIN_EMAIL",
            envVarValueMasked: maskEmail(adminEmailEnv),
            userValueName: "Authenticated User Email",
            userValue: user.email,
            matched: isAdmin,
        }};
        return jsonResponse(200, debugInfo);
    }

    // --- GEMINI API PROXY (:generateContent) ---
    if (event.httpMethod === 'POST' && requestPath.includes(':generateContent')) {
        const client = await pool.connect();
        try {
            // Use a transaction for an atomic credit check and deduction.
            await client.query('BEGIN');
            const userRes = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [user.id]);
            
            if (userRes.rows.length === 0) {
                // This is a safeguard. The user should have been created by /user-data.
                await client.query('ROLLBACK');
                return jsonResponse(404, { error: "User not found. Please log in again to initialize your account." });
            }

            const credits = userRes.rows[0].credits;
            if (credits <= 0) {
                await client.query('ROLLBACK');
                console.log(`Request blocked for user ${maskEmail(user.email)}: Out of credits.`);
                return jsonResponse(402, { error: "You are out of credits." });
            }

            await client.query('UPDATE users SET credits = credits - 1 WHERE id = $1', [user.id]);
            await client.query('COMMIT');
            console.log(`Credit deducted for ${maskEmail(user.email)}. New balance: ${credits - 1}`);

            // Proxy the request to Gemini
            const geminiUrl = `${GEMINI_API_BASE_URL}/${requestPath.replace('/v1beta/models/', 'v1beta/models/')}?key=${API_KEY}`;
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: event.body,
            });

            const responseBody = await geminiResponse.text();
            if (!geminiResponse.ok) {
                console.error(`Gemini API Error (Status: ${geminiResponse.status}):`, responseBody);
                // Credit is not refunded on API failure to prevent abuse (e.g., intentionally bad prompts).
            }
            return { statusCode: geminiResponse.status, body: responseBody };

        } catch (error) {
            console.error("Error in Gemini proxy transaction:", error);
            await client.query('ROLLBACK'); // Rollback on any error during the transaction
            return jsonResponse(500, { error: "An internal error occurred while processing your request.", details: getErrorMessage(error) });
        } finally {
            client.release();
        }
    }

    return jsonResponse(404, { error: `Not Found. The path '${requestPath}' is not handled.` });
};

export { handler };
// Shared Clerk token verification (NOT an endpoint — `_` prefix makes Vercel ignore it).
// Used by the destructive cancellation endpoints so the acting parent is derived from a
// verified session token, never from a client-supplied body field.
import { verifyToken } from '@clerk/clerk-sdk-node';

// Returns the verified Clerk user id (JWT `sub`), or null if missing/invalid.
// The frontend must send: Authorization: Bearer <await session.getToken()>.
export async function getVerifiedUserId(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1], { secretKey: process.env.CLERK_SECRET_KEY });
    return payload?.sub || null;
  } catch (e) {
    console.error('[auth] token verification failed:', e.message);
    return null;
  }
}

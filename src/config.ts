/** Build-time configuration.
 * VITE_BACKEND=1  → the app talks to the Medic Hub server (real accounts, shared PostgreSQL database).
 * otherwise       → standalone demo that keeps data in this browser only (used for the pitch link).
 */
const env = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env) || {}
export const IS_BROWSER = typeof window !== 'undefined'
export const BACKEND = env.VITE_BACKEND === '1'
/** Empty = same origin as the web app. */
export const API_URL = (env.VITE_API_URL ?? '').replace(/\/$/, '')
/** Demo affordances (demo accounts, sample codes, reset button) only exist in the standalone demo. */
export const DEMO = !BACKEND

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
/** Phone access (USSD menu and SMS). Real shortcodes are assigned by the networks; these show until then. */
export const USSD_CODE = (env.VITE_USSD_CODE as string | undefined) || '*347*633#'
export const SMS_NUMBER = (env.VITE_SMS_NUMBER as string | undefined) || '32112'
export const PHONE_LIVE = env.VITE_PHONE_LIVE === '1'

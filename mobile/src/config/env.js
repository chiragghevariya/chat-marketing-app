// ---------------------------------------------------------------------------
// Central app configuration.
//
// Replace these placeholder values with your real backend/Pusher/Stripe values.
// The defaults below assume the Laravel backend runs locally on port 8000.
//
// NOTE on host addresses while developing:
//   - Android emulator  -> use http://10.0.2.2:8000  (10.0.2.2 = host machine)
//   - iOS simulator     -> use http://localhost:8000
//   - Real device       -> use your computer's LAN IP, e.g. http://192.168.1.20:8000
// ---------------------------------------------------------------------------

// Root URL of the Laravel backend (NO trailing slash, NO /api).
//   - Physical phone (Expo Go via QR) -> your Mac's LAN IP (both on same Wi-Fi)
//   - Android emulator                -> http://10.0.2.2:8000
//   - iOS simulator                   -> http://localhost:8000
export const APP_BASE_URL = 'http://10.153.80.101:8000';

// REST API base — the Laravel routes are registered under the /api prefix.
export const API_BASE_URL = `${APP_BASE_URL}/api`;

// Pusher private-channel authorization endpoint (Laravel's /broadcasting/auth).
// This lives at the app root, NOT under /api.
export const BROADCASTING_AUTH_URL = `${APP_BASE_URL}/broadcasting/auth`;

// Pusher Channels credentials (from PUSHER_APP_KEY / PUSHER_APP_CLUSTER in the
// backend .env). Only the public app key + cluster are needed on the client.
export const PUSHER_KEY = '500f0851c29eedf7c4f7';
export const PUSHER_CLUSTER = 'ap2';

// Stripe publishable key (STRIPE_KEY in the backend .env, starts with pk_test_).
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SaXt3Be7lcgzOrDgqNNn0AYmjrp7T0nZbPreRD8NUTTi4t3ykiALBmewLMQPdGSGqL3rixcqujuDJKciUiG87gd00epUc9GJp';

// AsyncStorage key under which the JWT access token is persisted.
export const TOKEN_STORAGE_KEY = '@marketplace/jwt';

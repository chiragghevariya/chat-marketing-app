// ---------------------------------------------------------------------------
// Axios API client for the marketplace backend (Laravel REST API).
//
// - Holds the JWT in axios default headers (set by AuthContext via setAuthToken).
// - A request interceptor falls back to the persisted token in AsyncStorage so
//   the very first cold-start request is authenticated before AuthContext runs.
// - `api` exposes one method per backend endpoint; each returns response.data.
// ---------------------------------------------------------------------------

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from './env';

// Shared axios instance. API_BASE_URL already ends in /api.
const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

/**
 * Set (or clear) the in-memory bearer token used on every request.
 * Pass a token string to authenticate; pass null/undefined to log out.
 */
export function setAuthToken(token) {
  if (token) {
    http.defaults.headers.common.Authorization = 'Bearer ' + token;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
}

// App-level handler invoked when any request returns 401 (expired/invalid JWT).
// AuthContext registers its logout here so a stale session is cleared app-wide
// and RootNavigator routes the user back to Login. A re-entrancy guard prevents
// the handler's own logout request (which may also 401) from looping.
let onUnauthorized = null;
let handlingUnauthorized = false;

export function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error && error.response ? error.response.status : null;
    if (status === 401 && onUnauthorized && !handlingUnauthorized) {
      handlingUnauthorized = true;
      // Fire-and-forget; the original promise still rejects so callers can react.
      Promise.resolve()
        .then(() => onUnauthorized())
        .catch(() => {})
        .finally(() => {
          handlingUnauthorized = false;
        });
    }
    return Promise.reject(error);
  }
);

// Cold-start safety net: if no Authorization header is set yet (AuthContext has
// not run), read the persisted JWT from AsyncStorage and attach it.
http.interceptors.request.use(async (config) => {
  const hasHeader =
    config.headers &&
    (config.headers.Authorization ||
      (config.headers.common && config.headers.common.Authorization));

  if (!hasHeader) {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = 'Bearer ' + token;
      }
    } catch (e) {
      // Ignore storage read failures; request proceeds unauthenticated.
    }
  }

  return config;
});

/**
 * Build a multipart FormData body for creating a listing.
 * Scalars are appended only when present; images are appended under "images[]".
 */
function buildListingFormData(data) {
  const form = new FormData();

  // Append a scalar field only if it has a meaningful value.
  const appendIfPresent = (key, value) => {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  };

  appendIfPresent('title', data.title);
  appendIfPresent('description', data.description);
  appendIfPresent('price', data.price);
  appendIfPresent('category_id', data.category_id);
  appendIfPresent('status', data.status);
  appendIfPresent('condition', data.condition);
  appendIfPresent('location', data.location);
  appendIfPresent('lat', data.lat);
  appendIfPresent('lng', data.lng);
  appendIfPresent('primary_image', data.primary_image);

  // Attach image files (max 8 enforced by the backend) under the "images[]" key.
  if (Array.isArray(data.images)) {
    data.images.forEach((img, i) => {
      form.append('images[]', {
        uri: img.uri,
        name: img.fileName || 'photo_' + i + '.jpg',
        type: img.mimeType || 'image/jpeg',
      });
    });
  }

  return form;
}

// Reusable multipart header for file uploads.
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// Laravel serializes a SINGLE API Resource as { "data": {...} } when a controller
// returns it via ->response() (e.g. POST /conversations/{id}/messages). Other
// endpoints return the object flat, and Pusher event payloads are flat too. This
// normalizes a single wrapped resource to its flat object so callers always get a
// consistent shape with a valid top-level `id`. Paginated collections (which carry
// data + links/meta) are left untouched so list endpoints keep working as before.
function unwrapResource(body) {
  if (
    body &&
    typeof body === 'object' &&
    body.data &&
    !Array.isArray(body.data) &&
    body.links === undefined &&
    body.meta === undefined
  ) {
    return body.data;
  }
  return body;
}

// ---------------------------------------------------------------------------
// API surface — exact shape required by the rest of the app.
// Every method resolves to the parsed response body (response.data).
// ---------------------------------------------------------------------------
export const api = {
  auth: {
    // POST /auth/login -> { access_token, token_type, expires_in, user }
    login: (email, password) =>
      http.post('/auth/login', { email, password }).then((r) => r.data),
    // POST /auth/register -> same token shape. Accepts FormData (multipart) or
    // a plain object (JSON).
    register: (form) => {
      const isFormData =
        typeof FormData !== 'undefined' && form instanceof FormData;
      const request = isFormData
        ? http.post('/auth/register', form, MULTIPART)
        : http.post('/auth/register', form);
      return request.then((r) => r.data);
    },
    // GET /auth/me -> the user object directly
    me: () => http.get('/auth/me').then((r) => r.data),
    // POST /auth/logout -> { message }
    logout: () => http.post('/auth/logout').then((r) => r.data),
  },

  listings: {
    // GET /listings -> paginated { data, links, meta }
    list: (params) => http.get('/listings', { params }).then((r) => r.data),
    // GET /listings/{id} -> Listing
    get: (id) => http.get('/listings/' + id).then((r) => r.data),
    // POST /listings (multipart) -> 201 Listing
    create: (data) =>
      http
        .post('/listings', buildListingFormData(data), MULTIPART)
        .then((r) => r.data),
  },

  categories: {
    // GET /categories -> { data:[ category tree ] }
    list: () => http.get('/categories').then((r) => r.data),
  },

  conversations: {
    // GET /conversations -> paginated { data, links, meta }
    list: () => http.get('/conversations').then((r) => r.data),
    // POST /conversations { listing_id } -> Conversation
    start: (body) => http.post('/conversations', body).then((r) => r.data),
    // GET /conversations/{id}/messages -> paginated (newest first)
    messages: (id) =>
      http.get('/conversations/' + id + '/messages').then((r) => r.data),
    // POST /conversations/{id}/messages { content } -> Message
    // The endpoint returns the message wrapped as { data: {...} }; unwrap it so the
    // caller (ChatScreen.addMessage) receives a flat message with a top-level id.
    sendMessage: (id, content) =>
      http
        .post('/conversations/' + id + '/messages', { content })
        .then((r) => unwrapResource(r.data)),
    // POST /conversations/{id}/read -> { message, updated }
    markRead: (id) =>
      http.post('/conversations/' + id + '/read').then((r) => r.data),
  },

  orders: {
    // GET /orders -> paginated { data, links, meta }
    list: () => http.get('/orders').then((r) => r.data),
    // POST /orders { listing_id } -> { order, client_secret }
    create: (body) => http.post('/orders', body).then((r) => r.data),
    // POST /orders/{id}/confirm-payment -> { order, payment_status }
    confirmPayment: (id) =>
      http.post('/orders/' + id + '/confirm-payment').then((r) => r.data),
    // POST /orders/{id}/ship { tracking_number } -> { order }
    ship: (id, body) =>
      http.post('/orders/' + id + '/ship', body).then((r) => r.data),
    // POST /orders/{id}/complete -> { order }
    complete: (id) =>
      http.post('/orders/' + id + '/complete').then((r) => r.data),
  },

  sellerStripe: {
    // POST /seller/stripe/connect-account -> { onboarding_url, stripe_account_id }
    connect: () =>
      http.post('/seller/stripe/connect-account').then((r) => r.data),
  },

  deviceTokens: {
    // POST /device-tokens { token, platform } -> upsert this device's FCM token
    register: (body) =>
      http.post('/device-tokens', body).then((r) => r.data),
    // DELETE /device-tokens { token } -> remove this device's token (on logout)
    remove: (body) =>
      http.delete('/device-tokens', { data: body }).then((r) => r.data),
  },
};

export default api;

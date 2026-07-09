// ---------------------------------------------------------------------------
// AuthContext
//
// Holds the authenticated user + JWT token and exposes auth actions through a
// React Context. On mount it restores a persisted token from AsyncStorage and
// loads the current user. The JWT is sent on protected API calls via the
// shared axios instance configured by setAuthToken() in ../config/api.
// ---------------------------------------------------------------------------

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api, { setAuthToken, registerUnauthorizedHandler } from '../config/api';
import { TOKEN_STORAGE_KEY } from '../config/env';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/notifications';

// The context value shape is documented by the useAuth() consumer below.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  // Starts true so the app can show a splash/loading state until we know
  // whether a persisted session exists.
  const [loading, setLoading] = useState(true);

  // Holds the latest logout() so the global 401 handler (registered once) always
  // calls the current closure without re-registering on every render.
  const logoutRef = useRef(null);

  // Register a global handler so a 401 from ANY request clears the session and
  // sends the user back to Login — this also covers spots that used to swallow
  // errors (e.g. refreshUser().catch(() => {})).
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      if (logoutRef.current) logoutRef.current();
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  // Register for push notifications once the user is logged in. The reusable
  // service requests notification permission and generates + logs the FCM token.
  // It does NOT send the token anywhere or handle incoming messages yet.
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications();
  }, [user?.id]);

  // ---- Session restore on mount -------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

        if (storedToken) {
          // Attach the token to outgoing requests, then verify it by loading
          // the current user. api.auth.me() returns the user object directly.
          setAuthToken(storedToken);
          const me = await api.auth.me();

          if (mounted) {
            setToken(storedToken);
            setUser(me);
          }
        }
      } catch (e) {
        // A stale/invalid token (or a network failure) should not wedge the
        // app on the loading screen. Clear any partial auth state.
        setAuthToken(null);
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
        if (mounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        // Always release the loading gate, success or failure.
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---- Actions ------------------------------------------------------------

  // Persist a freshly obtained session (used by both login and register).
  async function persistSession(accessToken, userObj) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setAuthToken(accessToken);
    setToken(accessToken);
    setUser(userObj);
  }

  // Email/password login. Throws on failure so the screen can surface the error.
  async function login(email, password) {
    const res = await api.auth.login(email, password);
    const { access_token, user: userObj } = res;
    await persistSession(access_token, userObj);
    return userObj;
  }

  // Register a new account. `form` is the multipart payload assembled by the
  // screen (name, email, password, password_confirmation, phone?, role?, avatar?).
  // Same token handling as login. Throws on failure.
  async function register(form) {
    const res = await api.auth.register(form);
    const { access_token, user: userObj } = res;
    await persistSession(access_token, userObj);
    return userObj;
  }

  // Log out: best-effort server logout, then always clear the local session.
  async function logout() {
    // Remove this device's push token FIRST, while the JWT is still valid
    // (the DELETE endpoint is authenticated). Best-effort — never blocks logout.
    await unregisterPushNotifications();
    try {
      await api.auth.logout();
    } catch (e) {
      // Ignore server/network errors — we still clear local state below.
    }
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  // Reload the current user object (e.g. after Stripe onboarding changes
  // is_verified / stripe_account_id).
  async function refreshUser() {
    const me = await api.auth.me();
    setUser(me);
    return me;
  }

  // Keep the ref current so the 401 handler always invokes the latest logout.
  logoutRef.current = logout;

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Convenience hook for consuming the auth context.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;

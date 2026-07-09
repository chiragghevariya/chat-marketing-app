import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import api from '../config/api';
import { useAuth } from './AuthContext';
import { onNewMessage } from '../services/realtime';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch the conversation list from the backend
  const refreshConversations = useCallback(async (showSpinner = false) => {
    if (!token) return;
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const res = await api.conversations.list();
      setConversations(Array.isArray(res && res.data) ? res.data : []);
    } catch (e) {
      // Keep existing data on transient error
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load initially when the token changes, or clear if logged out
  useEffect(() => {
    if (!token) {
      setConversations([]);
    } else {
      refreshConversations(true);
    }
  }, [token, refreshConversations]);

  // Listen to FCM new message signals to update the list and badge live
  useEffect(() => {
    if (!token) return undefined;

    let timer = null;
    const unsubscribe = onNewMessage(() => {
      if (timer) clearTimeout(timer);
      // Debounce refreshes slightly to handle message bursts
      timer = setTimeout(() => {
        refreshConversations(false);
      }, 250);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [token, refreshConversations]);

  // Helper to mark a conversation read locally in UI state immediately
  const markLocalAsRead = useCallback((conversationId) => {
    if (!conversationId) return;
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(conversationId)
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  }, []);

  // Compute the number of conversations that have unread messages
  const unreadCount = conversations.filter(
    (c) => (c.unread_count || 0) > 0
  ).length;

  const value = {
    conversations,
    unreadCount,
    loading,
    refreshConversations,
    markLocalAsRead,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (ctx === null) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}

export default ChatContext;

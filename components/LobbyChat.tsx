'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  lobby_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface LobbyChatProps {
  lobbyId: string;
  currentUserId: string;
  currentUserName: string;
}

export default function LobbyChat({ lobbyId, currentUserId, currentUserName }: LobbyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial chat history
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('lobby_messages')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to live WebSocket updates for this specific lobby
    const channel = supabase
      .channel(`lobby-chat-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lobby_messages',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('lobby_messages').insert({
        lobby_id: lobbyId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        content: content,
      });

      if (error) throw error;
    } catch (err: any) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[400px] w-full rounded-3xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
      {/* CHAT HEADER */}
      <div className="px-5 py-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 className="text-xs font-black uppercase text-white tracking-wider">
            Split Partner Chat
          </h3>
        </div>
        <span className="text-[10px] font-bold text-neutral-500">Live WebSockets</span>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1 text-neutral-500">
            <span className="text-2xl">💬</span>
            <p className="text-xs font-bold text-neutral-400">No messages yet</p>
            <p className="text-[11px]">Say hi to coordinate your deal pickup or delivery!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[9px] font-bold text-neutral-500 mb-0.5 px-1">
                  {isMe ? 'You' : msg.sender_name}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                    isMe
                      ? 'bg-amber-400 text-black font-semibold rounded-br-none shadow-md'
                      : 'bg-neutral-900 text-neutral-200 border border-neutral-800 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[8px] text-neutral-600 mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* MESSAGE INPUT FORM */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Type a message to your split partner..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-black font-black uppercase text-xs px-4 py-2.5 rounded-xl transition shadow-md shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
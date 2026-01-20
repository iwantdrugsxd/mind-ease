import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Send, Bot, User, AlertCircle } from 'lucide-react';

interface Message {
  id?: number;
  message_type: 'user' | 'bot';
  content: string;
  detected_emotion?: string;
  emotion_confidence?: number;
  risk_level?: string;
  created_at?: string;
}

interface Conversation {
  id: number;
  session_id: string;
  messages: Message[];
}

const Chatbot: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initializeConversation = async () => {
      // Always allow input, even if user is not logged in (for testing)
      // But still try to initialize conversation if user exists
      const uid = user?.id || 'anonymous';

      // Try to rehydrate from localStorage first
      try {
        const storedId = localStorage.getItem(`chat_convo_id_${uid}`);
        if (storedId) {
          const detail = await api.get<Conversation>(`/screening/chatbot/conversations/${storedId}/`);
          setConversation(detail.data);
          setMessages(detail.data.messages || []);
          setIsInitializing(false);
          return;
        }
      } catch (e) {
        // fall through to normal init
      }

      if (!user) {
        console.log('No user, allowing anonymous access');
        setIsInitializing(false);
        // Create a default conversation for anonymous users
        try {
          const newConversationResponse = await api.post<Conversation>('/screening/chatbot/conversations/', {
            firebase_uid: 'anonymous'
          });
          console.log('Anonymous conversation created:', newConversationResponse.data);
          setConversation(newConversationResponse.data);
          setMessages([]);
          try { localStorage.setItem(`chat_convo_id_${uid}`, String(newConversationResponse.data.id)); } catch {}
        } catch (error: any) {
          console.error('Error creating anonymous conversation:', error);
          // Still allow input even if conversation creation fails
          setIsInitializing(false);
        }
        return;
      }

      try {
        console.log('Initializing conversation for user:', user.id);
        // Check if there's an existing conversation
        const response = await api.get<{
          count: number;
          next: string | null;
          previous: string | null;
          results: Conversation[];
        }>(`/screening/chatbot/conversations/?firebase_uid=${encodeURIComponent(user.id || 'anonymous')}`);
        console.log('Conversations response:', response.data);
        const conversations = response.data.results || [];

        if (conversations && conversations.length > 0) {
          // Use the most recent conversation
          const latestConversation = conversations[0];
          console.log('Using existing conversation:', latestConversation);
          setConversation(latestConversation);
          setMessages(latestConversation.messages || []);
          try { localStorage.setItem(`chat_convo_id_${user.id}`, String(latestConversation.id)); } catch {}
        } else {
          // Create a new conversation
          console.log('Creating new conversation');
          const newConversationResponse = await api.post<Conversation>('/screening/chatbot/conversations/', {
            firebase_uid: user.id
          });
          console.log('New conversation created:', newConversationResponse.data);
          setConversation(newConversationResponse.data);
          setMessages([]);
          try { localStorage.setItem(`chat_convo_id_${user.id}`, String(newConversationResponse.data.id)); } catch {}
        }
      } catch (error: any) {
        console.error('Error initializing conversation:', error);
        console.error('Error details:', error.response?.data || error.message);
        // Create a new conversation even if fetch fails
        try {
          console.log('Attempting to create conversation after error');
          const newConversationResponse = await api.post<Conversation>('/screening/chatbot/conversations/', {
            firebase_uid: user.id || 'anonymous'
          });
          console.log('Conversation created after error:', newConversationResponse.data);
          setConversation(newConversationResponse.data);
          setMessages([]);
          try { localStorage.setItem(`chat_convo_id_${user.id || 'anonymous'}`, String(newConversationResponse.data.id)); } catch {}
        } catch (createError: any) {
          console.error('Error creating conversation:', createError);
          console.error('Create error details:', createError.response?.data || createError.message);
          // Still allow input even if conversation creation fails
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeConversation();
  }, [user]);

  const handleSendMessage = async () => {
    const messageToSend = inputMessage.trim();
    
    if (!messageToSend) {
      console.log('No message to send');
      return;
    }
    
    if (isLoading) {
      console.log('Already sending a message');
      return;
    }
    
    // If no conversation exists, create one first
    let currentConversation = conversation;
    if (!currentConversation) {
      console.log('No conversation, creating one...');
      setIsLoading(true);
      try {
        const newConversationResponse = await api.post<Conversation>('/screening/chatbot/conversations/', {
          firebase_uid: user?.id || 'anonymous'
        });
        console.log('Conversation created on first message:', newConversationResponse.data);
        currentConversation = newConversationResponse.data;
        setConversation(currentConversation);
        try { localStorage.setItem(`chat_convo_id_${user?.id || 'anonymous'}`, String(currentConversation.id)); } catch {}
      } catch (createError: any) {
        console.error('Error creating conversation:', createError);
        setIsLoading(false);
        alert('Failed to initialize chatbot. Please refresh the page.');
        return;
      }
    }
    
    if (!currentConversation) {
      console.error('Still no conversation after creation attempt');
      setIsLoading(false);
      return;
    }

    console.log('Sending message:', messageToSend, 'to conversation:', currentConversation.id);

    const userMessage: Message = {
      message_type: 'user',
      content: messageToSend,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

        try {
          if (!currentConversation) {
            throw new Error('Conversation not initialized');
          }
          
          const response = await api.post<{
            user_message: Message;
            bot_response: Message;
            emotional_context?: any;
          }>(
            `/screening/chatbot/conversations/${currentConversation.id}/send-message/`,
            { 
              message: messageToSend,
              firebase_uid: user?.id || ''  // Include Firebase UID for patient matching
            }
          );

      console.log('Response received:', response.data);

      const { user_message, bot_response } = response.data;
      
      // Replace the temporary user message with the actual one from server
      setMessages(prev => {
        const filtered = prev.filter(m => m.message_type !== 'user' || m.content !== messageToSend);
        return [...filtered, user_message, bot_response];
      });

      // Check for critical risk
      if (user_message.risk_level === 'critical') {
        // Show alert
        alert('We detected a critical situation. Please reach out for immediate help:\n\n• Crisis Hotline: 988\n• Text HOME to: 741741\n• Emergency: 911');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Auto-heal: if conversation not found/access denied (stale ID), create a new one and retry once
      const isNotFound = error?.response?.status === 404;
      const errMsg = (error?.response?.data?.error || '').toString().toLowerCase();
      if (isNotFound && (errMsg.includes('conversation not found') || errMsg.includes('access denied'))) {
        try {
          console.log('Auto-heal: creating a new conversation and retrying...');
          const newConvRes = await api.post<Conversation>('/screening/chatbot/conversations/', {
            firebase_uid: user?.id || 'anonymous'
          });
          const newConv = newConvRes.data;
          setConversation(newConv);
          try { localStorage.setItem(`chat_convo_id_${user?.id || 'anonymous'}`, String(newConv.id)); } catch {}

          const retryRes = await api.post<{
            user_message: Message;
            bot_response: Message;
            emotional_context?: any;
          }>(
            `/screening/chatbot/conversations/${newConv.id}/send-message/`,
            {
              message: messageToSend,
              firebase_uid: user?.id || ''
            }
          );

          const { user_message, bot_response } = retryRes.data;
          setMessages(prev => {
            const filtered = prev.filter(m => m.message_type !== 'user' || m.content !== messageToSend);
            return [...filtered, user_message, bot_response];
          });
          return; // success after retry
        } catch (healErr: any) {
          console.error('Auto-heal failed:', healErr);
        }
      }

      // Remove the temporary user message on error
      setMessages(prev => prev.filter(m => m !== userMessage));

      const errorMessage: Message = {
        message_type: 'bot',
        content: error.response?.data?.error || error.response?.data?.message || "I'm sorry, I encountered an error. Please try again or contact support.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const QuickReplies: React.FC = () => {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        <button 
          onClick={() => navigate('/screening')} 
          className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors touch-manipulation font-medium"
        >
          Go to Screening
        </button>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors touch-manipulation font-medium"
        >
          Open Dashboard
        </button>
        <button 
          onClick={() => navigate('/self-care')} 
          className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors touch-manipulation font-medium"
        >
          Self-Care Hub
        </button>
        <button 
          onClick={() => setInputMessage('start PHQ-9')} 
          className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors touch-manipulation font-medium"
        >
          PHQ-9
        </button>
        <button 
          onClick={() => setInputMessage('start GAD-7')} 
          className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors touch-manipulation font-medium"
        >
          GAD-7
        </button>
      </div>
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('Enter key pressed, calling handleSendMessage');
      handleSendMessage();
    }
  };

  // Allow anonymous users for testing - removed the login requirement

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing chatbot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200" style={{ height: 'calc(100vh - 4rem)', minHeight: '600px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 sm:p-5 shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h2 className="text-lg sm:text-xl font-bold">MindEase Support Chatbot</h2>
                <p className="text-xs sm:text-sm text-primary-100">AI-powered mental health support</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50 to-white">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-12 sm:py-16">
                <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                  <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-primary-600" />
                </div>
                <p className="text-base sm:text-lg font-medium">Start a conversation!</p>
                <p className="text-sm sm:text-base mt-1">I'm here to support you.</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 sm:gap-3 ${
                    message.message_type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.message_type === 'bot' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-sm">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-sm ${
                      message.message_type === 'user'
                        ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-sm'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{message.content}</p>
                    {message.message_type === 'user' && message.risk_level === 'critical' && (
                      <div className="mt-2 flex items-center text-yellow-200 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Critical risk detected
                      </div>
                    )}
                    {message.detected_emotion && message.message_type === 'user' && (
                      <div className="mt-1.5 text-xs opacity-80">
                        Emotion: {message.detected_emotion} ({Math.round((message.emotion_confidence || 0) * 100)}%)
                      </div>
                    )}
                  </div>

                  {message.message_type === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center shadow-sm">
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start justify-start gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-sm">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                  </div>
                </div>
                <div className="bg-white text-gray-900 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 sm:p-4 bg-white">
            <div className="flex gap-2 sm:gap-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={conversation ? "Type your message..." : "Initializing chatbot..."}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-sm sm:text-base"
                rows={2}
                disabled={isLoading || isInitializing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || isInitializing}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg transition-all touch-manipulation"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-1">
              Press Enter to send, Shift+Enter for new line
            </p>
            <QuickReplies />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;


import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Send, Bot, User, AlertCircle } from 'lucide-react';

type AssistantGuidanceAction = {
  label: string;
  action_key: 'Go to Screening' | 'Open Self-Care' | 'Open Dashboard' | 'Open Care Team';
  route: string;
};

type AssistantGuidance = {
  policy_type: 'guided_support' | 'screening_prompt' | 'self_care_routing' | 'followup_recommended' | 'urgent_escalation' | 'out_of_scope';
  urgency: 'routine' | 'elevated' | 'critical';
  actions: AssistantGuidanceAction[];
  safety_notice?: string | null;
  handoff_recommended?: boolean;
};

type WorkflowState = {
  workflow_type: 'guided_support' | 'screening' | 'self_care' | 'care_team_handoff' | 'urgent_escalation';
  next_route?: string | null;
  alert_id?: number | null;
  referral_id?: number | null;
  care_team_available?: boolean;
  has_recent_screening?: boolean;
};

interface Message {
  id?: number;
  message_type: 'user' | 'bot';
  content: string;
  detected_emotion?: string;
  emotion_confidence?: number;
  risk_level?: string;
  created_at?: string;
  assistant_guidance?: AssistantGuidance;
  workflow_state?: WorkflowState;
}
interface Conversation {
  id: number;
  session_id: string;
  messages: Message[];
}

type ChatAction = {
  label: string;
  path: string;
};

const CHAT_ACTIONS: Record<string, ChatAction> = {
  'Go to Screening': { label: 'Go to Screening', path: '/screening' },
  'Open Self-Care': { label: 'Open Self-Care', path: '/selfcare' },
  'Open Dashboard': { label: 'Open Dashboard', path: '/dashboard' },
  'Open Care Team': { label: 'Open Care Team', path: '/care-team' },
};

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
            assistant_guidance?: AssistantGuidance;
            workflow_state?: WorkflowState;
          }>(
            `/screening/chatbot/conversations/${currentConversation.id}/send-message/`,
            { 
              message: messageToSend,
              firebase_uid: user?.id || ''  // Include Firebase UID for patient matching
            }
          );

      console.log('Response received:', response.data);

      const { user_message, bot_response, assistant_guidance, workflow_state } = response.data;
      const enrichedBotResponse: Message = {
        ...bot_response,
        assistant_guidance,
        workflow_state,
      };
      
      // Replace the temporary user message with the actual one from server
      setMessages(prev => {
        const filtered = prev.filter(m => m.message_type !== 'user' || m.content !== messageToSend);
        return [...filtered, user_message, enrichedBotResponse];
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
            assistant_guidance?: AssistantGuidance;
            workflow_state?: WorkflowState;
          }>(
            `/screening/chatbot/conversations/${newConv.id}/send-message/`,
            {
              message: messageToSend,
              firebase_uid: user?.id || ''
            }
          );

          const { user_message, bot_response, assistant_guidance, workflow_state } = retryRes.data;
          const enrichedBotResponse: Message = {
            ...bot_response,
            assistant_guidance,
            workflow_state,
          };
          setMessages(prev => {
            const filtered = prev.filter(m => m.message_type !== 'user' || m.content !== messageToSend);
            return [...filtered, user_message, enrichedBotResponse];
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
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors touch-manipulation font-medium"
        >
          Go to Screening
        </button>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors touch-manipulation font-medium"
        >
          Open Dashboard
        </button>
        <button 
          onClick={() => navigate('/self-care')} 
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors touch-manipulation font-medium"
        >
          Self-Care Hub
        </button>
        <button 
          onClick={() => setInputMessage('start PHQ-9')} 
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors touch-manipulation font-medium"
        >
          PHQ-9
        </button>
        <button 
          onClick={() => setInputMessage('start GAD-7')} 
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors touch-manipulation font-medium"
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

  const renderMessageContent = (message: Message) => {
    const lines = message.content.split('\n');
    const fallbackActionKeys = lines
      .map((line) => line.trim())
      .filter((line) => /^\[[^\]]+\]$/.test(line))
      .map((line) => line.slice(1, -1))
      .filter((line): line is keyof typeof CHAT_ACTIONS => Boolean(CHAT_ACTIONS[line]));
    const guidanceActions = message.assistant_guidance?.actions || [];
    const actionKeys = guidanceActions.length > 0
      ? guidanceActions.map((action) => action.action_key)
      : fallbackActionKeys;
    const textLines = lines.filter((line) => !/^\[[^\]]+\]$/.test(line.trim()));

    return (
      <div className="space-y-3">
        <div className="space-y-1">
          {message.assistant_guidance?.safety_notice ? (
            <div className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              message.assistant_guidance.urgency === 'critical'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {message.assistant_guidance.safety_notice}
            </div>
          ) : null}
          {textLines.map((line, idx) => (
            <p key={idx} className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
              {line || '\u00A0'}
            </p>
          ))}
          {message.workflow_state?.workflow_type && message.message_type === 'bot' ? (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Workflow</div>
              <div className="mt-1 text-sm font-medium text-slate-800">
                {message.workflow_state.workflow_type === 'care_team_handoff' && 'Clinician follow-up is available in Care Team.'}
                {message.workflow_state.workflow_type === 'screening' && 'A screening step is recommended next.'}
                {message.workflow_state.workflow_type === 'self_care' && 'A self-care path is recommended next.'}
                {message.workflow_state.workflow_type === 'urgent_escalation' && 'Urgent support steps were triggered.'}
                {message.workflow_state.workflow_type === 'guided_support' && 'Guided in-app support is available.'}
              </div>
            </div>
          ) : null}
        </div>
        {actionKeys.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actionKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(CHAT_ACTIONS[key].path)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  message.message_type === 'user'
                    ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                    : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {CHAT_ACTIONS[key].label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  // Allow anonymous users for testing - removed the login requirement

  if (isInitializing) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Initializing chatbot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)] flex flex-col min-h-[72vh] sm:min-h-[620px]">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">AI support</p>
                <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-950">Chat</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 bg-[linear-gradient(180deg,rgba(248,250,252,0.55),rgba(255,255,255,0.96))]">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-12 sm:py-16">
                <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-slate-700" />
                </div>
                <p className="text-base sm:text-lg font-medium text-slate-900">Start a conversation</p>
                <QuickReplies />
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
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[92%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-sm ${
                      message.message_type === 'user'
                        ? 'bg-slate-950 text-white rounded-tr-md'
                        : 'bg-white text-slate-900 border border-slate-200 rounded-tl-md'
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
                      {message.message_type === 'user' ? 'You' : 'Chatbot'}
                    </div>
                    {renderMessageContent(message)}
                    {message.message_type === 'user' && message.risk_level === 'critical' && (
                      <div className="mt-2 flex items-center text-amber-200 text-xs">
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
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-2xl bg-slate-200 flex items-center justify-center shadow-sm">
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start justify-start gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
                  </div>
                </div>
                <div className="bg-white text-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-tl-md border border-slate-200 shadow-sm">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-2 sm:gap-3 items-end">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={conversation ? "Type your message..." : "Initializing chatbot..."}
                className="flex-1 px-3 sm:px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed text-sm sm:text-base"
                rows={3}
                disabled={isLoading || isInitializing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || isInitializing}
                className="shrink-0 bg-slate-950 text-white px-4 sm:px-6 py-3 rounded-xl hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all touch-manipulation"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500 px-1 w-full sm:w-auto">
                Enter to send
              </p>
              {messages.length > 0 ? <QuickReplies /> : null}
            </div>
          </div>
      </section>
    </div>
  );
};

export default Chatbot;

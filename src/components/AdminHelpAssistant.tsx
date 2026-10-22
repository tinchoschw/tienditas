import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  RotateCcw, 
  ChevronDown, 
  HelpCircle, 
  Check, 
  Copy, 
  ExternalLink,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

interface AdminHelpAssistantProps {
  storeSlug: string;
  storeName?: string;
  currentTab?: string;
  isOpen: boolean;
  onToggle?: () => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  '¿Cómo creo un producto a mano o con IA?',
  '¿Cómo cargo talles, colores y stock?',
  '¿Cómo registro una venta en mostrador?',
  '¿Cómo vinculo mi cuenta de Mercado Pago?',
  '¿Cómo cambio mi clave de administrador?',
  '¿Qué significa "Cupo máximo alcanzado"?'
];

export const AdminHelpAssistant: React.FC<AdminHelpAssistantProps> = ({
  storeSlug,
  storeName,
  currentTab,
  isOpen,
  onToggle,
  onClose
}) => {
  const storageKey = `atelier_assistant_chat_${storeSlug || 'default'}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn(e);
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        content: `¡Hola! 👋 Soy tu asistente para ayudarte a administrar **${storeName || 'tu tienda'}**. Podés preguntarme cualquier duda sobre cómo cargar prendas, registrar ventas, cobrar con Mercado Pago, personalizar el diseño o resolver algún error de la plataforma.\n\n¿En qué te puedo dar una mano hoy?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'es-AR';

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceNotice('Escuchando... podés hablar ahora');
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInputMessage(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event?.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setVoiceNotice('Permiso de micrófono no concedido');
          } else {
            setVoiceNotice('No se detectó voz o hubo un error');
          }
          setTimeout(() => setVoiceNotice(null), 3000);
        };

        recognition.onend = () => {
          setIsListening(false);
          setVoiceNotice(null);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition init error:', err);
      }
    }
  }, []);

  // Persist messages in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn(e);
    }
  }, [messages, storageKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Tu navegador no soporta entrada de voz directa. Podés escribir tu consulta en el campo de texto.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Failed to start recognition:', err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter(m => m.id !== 'welcome')
            .map(m => ({
              role: m.role === 'model' ? 'model' : 'user',
              content: m.content
            })),
          storeSlug,
          storeName,
          currentTab
        })
      });

      let modelReply = '';
      try {
        const data = await response.json();
        modelReply = data.reply || data.error;
      } catch (parseErr) {
        console.warn('Could not parse JSON response:', parseErr);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'model',
        content: modelReply || 'Disculpá, no pude procesar tu consulta en este momento. Por favor, probá de nuevo en unos segundos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Network or communication issue sending message to assistant:', err);
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'model',
        content: 'Tuve un inconveniente de conexión al consultar la guía en este momento. Por favor, revisá tu conexión e intentá de nuevo en unos segundos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    const welcome: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'model',
      content: `¡Chat reiniciado! 🧹 Podés preguntarme cualquier duda sobre **${storeName || 'tu tienda'}**.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([welcome]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render bold markdown and numbered lists nicely
  const formatAssistantContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Check for numbered list e.g. "1. ", "2. "
      const listMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (listMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
              {listMatch[1]}
            </span>
            <span className="flex-1 text-[13px] text-neutral-800 leading-relaxed">
              {renderFormattedSpans(listMatch[2])}
            </span>
          </div>
        );
      }

      // Check for bullet lists e.g. "- ", "* "
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 my-0.5 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0" />
            <span className="flex-1 text-[13px] text-neutral-800 leading-relaxed">
              {renderFormattedSpans(bulletText)}
            </span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-[13px] text-neutral-800 leading-relaxed my-1">
          {renderFormattedSpans(line)}
        </p>
      );
    });
  };

  const renderFormattedSpans = (text: string) => {
    // Split by **bold** or `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-neutral-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <span key={i} className="px-1.5 py-0.5 rounded bg-neutral-100 font-mono text-[11px] text-neutral-800 border border-neutral-200">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop overlay to focus on the assistant */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 sm:hidden animate-fade-in"
        title="Tocar para cerrar"
      />

      {/* Floating Chat Panel Modal */}
      <div className="fixed bottom-3 sm:bottom-6 right-2 sm:right-6 z-50 w-[calc(100vw-16px)] sm:w-[430px] h-[580px] sm:h-[640px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-fade-in font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-neutral-700/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-inner relative">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-neutral-900" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white">
                    Asistente de tu Tienda
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    IA
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 flex items-center gap-1">
                  <span>Guía oficial de la plataforma</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">En línea</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-700/60 transition-colors"
                title="Limpiar conversación"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-700/60 transition-colors"
                title="Cerrar asistente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Context Bar */}
          <div className="bg-neutral-50 px-4 py-1.5 border-b border-neutral-200/80 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="truncate max-w-[240px]">
              Tienda: <strong className="text-neutral-700">{storeName || storeSlug}</strong>
            </span>
            <span className="text-neutral-400">
              Pestaña: {currentTab || 'General'}
            </span>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#faf9f8]">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'model';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-end gap-2 max-w-[90%]">
                    {isAssistant && (
                      <div className="w-7 h-7 rounded-lg bg-neutral-900 text-amber-300 flex items-center justify-center shrink-0 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`relative px-3.5 py-2.5 rounded-2xl shadow-sm text-xs sm:text-sm ${
                        isAssistant
                          ? 'bg-white text-neutral-900 border border-neutral-200/90 rounded-bl-xs'
                          : 'bg-neutral-900 text-white rounded-br-xs'
                      }`}
                    >
                      {isAssistant ? (
                        formatAssistantContent(msg.content)
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}

                      {/* Assistant actions: Copy */}
                      {isAssistant && msg.id !== 'welcome' && (
                        <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
                          <span>{msg.timestamp}</span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-800 transition-colors"
                            title="Copiar respuesta"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isAssistant && (
                    <span className="text-[10px] text-neutral-400 mt-1 mr-1">
                      {msg.timestamp}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-end gap-2 max-w-[85%]">
                <div className="w-7 h-7 rounded-lg bg-neutral-900 text-amber-300 flex items-center justify-center shrink-0 mb-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="px-4 py-3 bg-white border border-neutral-200 rounded-2xl rounded-bl-xs shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-neutral-500 font-medium ml-1">Consultando la guía...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          {messages.length <= 3 && !isLoading && (
            <div className="px-3 py-2 bg-white border-t border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-semibold text-neutral-400 shrink-0 uppercase tracking-wider">
                Sugerencias:
              </span>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 whitespace-nowrap transition-colors shrink-0 cursor-pointer border border-neutral-200/60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Voice Notice status */}
          {voiceNotice && (
            <div className="px-4 py-1.5 bg-amber-50 text-amber-800 text-[11px] font-medium border-t border-amber-200 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>{voiceNotice}</span>
              </div>
              {isListening && (
                <button
                  onClick={toggleListening}
                  className="text-red-700 underline font-semibold text-[10px]"
                >
                  Detener
                </button>
              )}
            </div>
          )}

          {/* Input Form */}
          <div className="p-3 bg-white border-t border-neutral-200">
            <div className="relative flex items-end gap-1.5 bg-neutral-50 border border-neutral-300 rounded-xl p-1.5 focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 transition-all">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Hablá con tranquilidad...' : 'Escribí tu pregunta o tocá el mic...'}
                rows={1}
                className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none p-1.5 max-h-24 overflow-y-auto leading-relaxed"
              />

              {/* Speech Recognition Button */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-md'
                      : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60'
                  }`}
                  title={isListening ? 'Detener micrófono' : 'Hablar por micrófono (dictar pregunta)'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                  inputMessage.trim() && !isLoading
                    ? 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-300 cursor-not-allowed'
                }`}
                title="Enviar mensaje (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 px-1">
              <span>Respuestas basadas en la guía oficial de tu tienda</span>
              <span>Enter para enviar</span>
            </div>
          </div>
        </div>
    </>
  );
};

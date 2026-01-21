
import React, { useState, useEffect, useRef } from 'react';
import { Chat, GenerateContentResponse } from "@google/genai";
import { createInteractiveChat } from '../services/geminiService';
import type { ChatMessage } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface InteractiveAssistantProps {
    onClose: () => void;
    onUpdateFields: (fields: {
        objective?: string;
        audienceAction?: string;
        keyMessage?: string;
        context?: string;
    }) => void;
    initialFormState: {
        objective: string;
        audienceAction: string;
        keyMessage: string;
        context: string;
    };
}

const FormattedMessage: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
    if (isUser) return <>{text}</>;
    const htmlContent = marked.parse(text);
    const sanitizedHtml = DOMPurify.sanitize(htmlContent as string);
    return (
        <div 
            className="prose-chat"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
        />
    );
};

const InteractiveAssistant: React.FC<InteractiveAssistantProps> = ({ onClose, onUpdateFields, initialFormState }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [lastUpdateInfo, setLastUpdateInfo] = useState<string | null>(null);
    const chatSessionRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // IMPORTANTE: Inicializar solo una vez al montar para evitar reinicios de sesión
    useEffect(() => {
        const initChat = async () => {
            // Usamos el estado inicial proporcionado al abrir el asistente
            chatSessionRef.current = createInteractiveChat(initialFormState);
            setIsTyping(true);
            try {
                const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({
                    message: "Hola, analicemos la campaña." 
                });
                
                if (response.text) {
                     setMessages([{ role: 'model', text: response.text }]);
                }
            } catch (error) {
                console.error("Error initializing chat:", error);
                setMessages([{ role: 'model', text: "Lo siento, tuve un problema al iniciar. Por favor intenta de nuevo." }]);
            } finally {
                setIsTyping(false);
            }
        };

        initChat();
    }, []); // Array vacío para que solo se ejecute al montar

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !chatSessionRef.current) return;

        const userMsg = inputValue;
        setInputValue('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);
        setLastUpdateInfo(null);

        try {
            let response: GenerateContentResponse = await chatSessionRef.current.sendMessage({
                message: userMsg
            });

            let functionCalls = response.functionCalls;
            while (functionCalls && functionCalls.length > 0) {
                const functionResponses = [];
                for (const call of functionCalls) {
                    if (call.name === 'update_form_fields') {
                        const args = call.args as any;
                        onUpdateFields(args);
                        
                        // Notificar qué se actualizó
                        const updatedFields = Object.keys(args).join(', ');
                        setLastUpdateInfo(`Actualizado: ${updatedFields}`);
                        setTimeout(() => setLastUpdateInfo(null), 3000);

                        functionResponses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: "success: fields updated in the interface" }
                        });
                    }
                }

                if (functionResponses.length > 0) {
                     response = await chatSessionRef.current.sendMessage({
                         message: functionResponses.map(fr => ({ functionResponse: fr })) 
                     });
                     functionCalls = response.functionCalls;
                } else {
                    functionCalls = undefined;
                }
            }

            if (response.text) {
                setMessages(prev => [...prev, { role: 'model', text: response.text }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "Hubo un error de conexión. ¿Podrías repetir eso?" }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <div className="bg-indigo-500 rounded-full p-1.5">
                            <Icon name="sparkles" className="w-5 h-5 text-white" />
                         </div>
                         <div>
                             <h3 className="font-bold text-white">Asistente Creativo</h3>
                             <p className="text-xs text-indigo-300">Modo Interactivo (Gemini 3)</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-900/50 relative">
                    {/* Alerta de actualización */}
                    {lastUpdateInfo && (
                        <div className="sticky top-0 z-10 flex justify-center animate-bounce">
                            <div className="bg-green-600/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-md border border-green-500">
                                <Icon name="sparkles" className="w-3 h-3" />
                                {lastUpdateInfo}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none shadow-sm'
                            }`}>
                                <FormattedMessage text={msg.text} isUser={msg.role === 'user'} />
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <div className="flex items-end gap-2 bg-slate-900 border border-slate-600 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu respuesta..."
                            className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none outline-none max-h-32 py-2 px-2"
                            rows={1}
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isTyping}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition-colors flex-shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-semibold">
                        El asistente actualizará el formulario automáticamente.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InteractiveAssistant;

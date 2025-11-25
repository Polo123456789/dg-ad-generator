
import React, { useState, useEffect, useRef } from 'react';
import { Chat, GenerateContentResponse } from "@google/genai";
import { createInteractiveChat } from '../services/geminiService';
import type { ChatMessage } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';

interface InteractiveAssistantProps {
    onClose: () => void;
    onUpdateFields: (fields: {
        objective?: string;
        audienceAction?: string;
        keyMessage?: string;
        context?: string;
    }) => void;
}

const InteractiveAssistant: React.FC<InteractiveAssistantProps> = ({ onClose, onUpdateFields }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatSessionRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize Chat
    useEffect(() => {
        const initChat = async () => {
            chatSessionRef.current = createInteractiveChat();
            setIsTyping(true);
            try {
                // Initial greeting trigger (empty message to start flow or explicit prompt)
                const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({
                    message: "Hola, empecemos." 
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
    }, []);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !chatSessionRef.current) return;

        const userMsg = inputValue;
        setInputValue('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            let response: GenerateContentResponse = await chatSessionRef.current.sendMessage({
                message: userMsg
            });

            // Handle Function Calls (Tools) loop
            // The model might want to call a function. We must execute it and send the result back.
            let functionCalls = response.functionCalls;
            
            while (functionCalls && functionCalls.length > 0) {
                const functionResponses = [];
                
                for (const call of functionCalls) {
                    if (call.name === 'update_form_fields') {
                        // Execute UI Update
                        const args = call.args as any;
                        console.log("Assistant updating fields:", args);
                        onUpdateFields(args);
                        
                        // Prepare response for model
                        functionResponses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: "success: fields updated in UI" }
                        });
                    }
                }

                // Send tool execution result back to Gemini
                if (functionResponses.length > 0) {
                     response = await chatSessionRef.current.sendMessage({
                         message: functionResponses.map(fr => ({ functionResponse: fr })) 
                     });
                     // Check if new response has more function calls or text
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
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <div className="bg-indigo-500 rounded-full p-1.5">
                            <Icon name="sparkles" className="w-5 h-5 text-white" />
                         </div>
                         <div>
                             <h3 className="font-bold text-white">Asistente Creativo</h3>
                             <p className="text-xs text-indigo-300">Modo Interactivo (Gemini 2.5)</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
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
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                        El asistente actualizará el formulario automáticamente. No olvides adjuntar tus imágenes al final.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InteractiveAssistant;

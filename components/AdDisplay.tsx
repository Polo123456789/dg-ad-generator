
import React, { useState, useCallback, useEffect } from 'react';
import type { AdCreative, AdVariant } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';

interface AdDisplayProps {
  creative: AdCreative;
  onRegenerate: (id: string, ratio: string, newPrompt: string, newImageSize: string) => void;
  onEdit: (id: string, ratio: string, editPrompt: string, imageSize: string) => void;
  onSetActiveVariant: (id: string, ratio: string) => void;
  onApprove?: (id: string) => void;
  onNavigateHistory?: (id: string, ratio: string, direction: 'prev' | 'next') => void;
  onDiscard?: (id: string) => void;
  onDownloadZip?: (id: string) => void;
}

const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
        case '1:1': return 'aspect-square';
        case '9:16': return 'aspect-[9/16]';
        case '3:4': return 'aspect-[3/4]';
        case '16:9': return 'aspect-video';
        case '4:3':
        default:
            return 'aspect-[4/3]';
    }
};

const AdDisplay: React.FC<AdDisplayProps> = ({ creative, onRegenerate, onEdit, onSetActiveVariant, onApprove, onNavigateHistory, onDiscard, onDownloadZip }) => {
  const activeVariantKey = creative.activeVariant;
  const activeVariant = creative.variants[activeVariantKey];
  
  // Use history to determine current image
  const currentImage = activeVariant?.history[activeVariant.currentHistoryIndex];
  
  const isPreviewMode = creative.status === 'preview_ready' || creative.status === 'generating_preview';
  const isImagePreview = currentImage?.isPreview; // Is the specifically displayed image a preview?

  const [promptContent, setPromptContent] = useState(activeVariant?.imagePrompt || '');
  const [imageSize, setImageSize] = useState(creative.imageSize || '1K');
  const [editPrompt, setEditPrompt] = useState('');

  // Update local state when active variant changes
  useEffect(() => {
      if (activeVariant) {
          setPromptContent(activeVariant.imagePrompt);
      }
  }, [activeVariant]);

  const handleRegenerateClick = useCallback(() => {
    onRegenerate(creative.id, activeVariantKey, promptContent, imageSize);
  }, [onRegenerate, creative.id, activeVariantKey, promptContent, imageSize]);

  const handleEditClick = useCallback(() => {
    if (editPrompt.trim()) {
        onEdit(creative.id, activeVariantKey, editPrompt, imageSize);
        setEditPrompt('');
    }
  }, [onEdit, creative.id, activeVariantKey, editPrompt, imageSize]);
  
  const availableRatios = Object.keys(creative.variants);

  if (!activeVariant) return null;

  return (
    <div className={`bg-slate-800/60 backdrop-blur-md border rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-indigo-500/20 flex flex-col md:flex-row h-auto min-h-[600px] ${isPreviewMode ? 'border-amber-500/50' : 'border-slate-700 hover:border-slate-600'}`}>
      
      {/* Left Column: Image Area */}
      <div className="md:w-1/2 lg:w-3/5 bg-slate-900 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 relative">
        
        {/* Preview Badge */}
        {isImagePreview && (
             <div className="absolute top-0 left-0 z-20 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-br-lg shadow-md flex items-center gap-1">
                 <Icon name="sparkles" className="w-3 h-3" />
                 PREVIEW (Imagen 4)
             </div>
        )}

        {/* Tabs for Aspect Ratios */}
        <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto scrollbar-hide">
            {availableRatios.map(ratio => {
                // Determine if tab should be disabled: In preview mode, only allow tabs that have data or are generating
                const variant = creative.variants[ratio];
                const hasHistory = variant.history && variant.history.length > 0;
                const isTabDisabled = isPreviewMode && !hasHistory && !variant.isGenerating;
                
                return (
                    <button
                        key={ratio}
                        onClick={() => !isTabDisabled && onSetActiveVariant(creative.id, ratio)}
                        disabled={isTabDisabled}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap relative
                            ${activeVariantKey === ratio 
                                ? 'border-indigo-500 text-white bg-slate-800' 
                                : isTabDisabled
                                    ? 'border-transparent text-slate-700 cursor-not-allowed'
                                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                    >
                        {ratio}
                        {isTabDisabled && <span className="absolute top-1 right-2 text-[8px] text-amber-500">🔒</span>}
                    </button>
                );
            })}
        </div>

        {/* Main Image Viewport */}
        <div className="flex-grow flex items-center justify-center p-4 md:p-8 relative min-h-[400px]">
            <div className={`relative w-full max-w-full h-auto shadow-2xl ${getAspectRatioClass(activeVariantKey)} group`}>
                
                {/* Generation Spinner Overlay */}
                {activeVariant.isGenerating && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                    <Spinner className="w-10 h-10" />
                    <p className="text-slate-300 mt-2 text-sm font-medium animate-pulse">
                        {isPreviewMode && activeVariantKey === creative.activeVariant ? 'Generando Preview (Imagen 4)...' : `Diseñando para ${activeVariantKey}...`}
                    </p>
                </div>
                )}
                
                {/* Image Display */}
                {currentImage ? (
                    <>
                        <img src={currentImage.url} alt={creative.title} className="w-full h-full object-contain bg-slate-950 rounded-lg" />
                        
                        {/* Carousel Navigation Buttons */}
                        {activeVariant.history.length > 1 && (
                            <>
                                <button 
                                    onClick={() => onNavigateHistory && onNavigateHistory(creative.id, activeVariantKey, 'prev')}
                                    disabled={activeVariant.currentHistoryIndex === 0}
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full disabled:opacity-30 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => onNavigateHistory && onNavigateHistory(creative.id, activeVariantKey, 'next')}
                                    disabled={activeVariant.currentHistoryIndex === activeVariant.history.length - 1}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full disabled:opacity-30 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    Versión {activeVariant.currentHistoryIndex + 1} / {activeVariant.history.length}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                     !activeVariant.isGenerating && (
                         <div className="w-full h-full bg-slate-800 rounded-lg flex items-center justify-center flex-col gap-2 text-slate-500 text-sm p-4 text-center">
                             {isPreviewMode ? (
                                 <>
                                     <span className="text-2xl">🔒</span>
                                     <span>Aprueba el preview para generar este formato.</span>
                                 </>
                             ) : (
                                 <>
                                     <span className="text-2xl">⏳</span>
                                     <span>Esperando generación...</span>
                                 </>
                             )}
                         </div>
                     )
                )}
            </div>
        </div>
      </div>

      {/* Right Column: Controls */}
      <div className="md:w-1/2 lg:w-2/5 flex flex-col bg-slate-800/50">
          <div className="p-6 border-b border-slate-700 flex justify-between items-start gap-4">
            <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1">{creative.title}</h3>
                <p className="text-slate-400 text-sm">{creative.subtitle}</p>
            </div>
            <div className="flex gap-2">
                {onDownloadZip && (
                    <button
                        onClick={() => onDownloadZip(creative.id)}
                        className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
                        title="Descargar ZIP (Texto + Imágenes)"
                    >
                        <Icon name="download" className="w-5 h-5" />
                    </button>
                )}
                {onDiscard && (
                    <button
                        onClick={() => onDiscard(creative.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Descartar concepto"
                    >
                        <Icon name="trash" className="w-5 h-5" />
                    </button>
                )}
            </div>
          </div>

          <div className="p-6 flex-grow flex flex-col space-y-6 overflow-y-auto">
            
            {/* APPROVE ACTION FOR PREVIEW */}
            {isPreviewMode && creative.status === 'preview_ready' && (
                <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 mb-4">
                    <h4 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                         <Icon name="sparkles" className="w-4 h-4" />
                         Modo Vista Previa
                    </h4>
                    <p className="text-slate-300 text-xs mb-4">
                        Este es un borrador rápido generado con Imagen 4. Si te gusta el concepto, apruébalo para generar todos los formatos en Alta Calidad con Gemini 3 Pro.
                    </p>
                    <button
                        onClick={() => onApprove && onApprove(creative.id)}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                         <span>Aprobar y Generar Todo (HD)</span>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                         </svg>
                    </button>
                </div>
            )}

            {/* Prompt Editor */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Prompt de Composición ({activeVariantKey})
                </label>
                <textarea
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    rows={8}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 font-mono leading-relaxed focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 scrollbar-thin scrollbar-thumb-slate-700 transition-all"
                    disabled={activeVariant.isGenerating}
                />
            </div>

            {/* Regeneration Controls */}
            {(!isPreviewMode || (isPreviewMode && activeVariant.history.length > 0)) && (
                <div className="space-y-4">
                    <div>
                        <label htmlFor={`image-size-${creative.id}`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Resolución</label>
                        <select 
                            id={`image-size-${creative.id}`}
                            value={imageSize} 
                            onChange={(e) => setImageSize(e.target.value)} 
                            disabled={activeVariant.isGenerating} 
                            className="w-full bg-slate-700 text-slate-200 text-sm font-medium py-2 px-3 rounded-lg hover:bg-slate-600 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        >
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                        </select>
                    </div>

                    <button
                        onClick={handleRegenerateClick}
                        disabled={activeVariant.isGenerating}
                        className="w-full flex items-center justify-center gap-2 bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        <Icon name="regenerate" className="w-5 h-5"/>
                        {isPreviewMode ? 'Regenerar Preview' : `Regenerar Variante ${activeVariantKey}`}
                    </button>
                </div>
            )}

            {/* Edit Section */}
            {(!isPreviewMode) && (
                <div className="pt-6 border-t border-slate-700">
                    <label htmlFor={`edit-prompt-${creative.id}`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Edición Rápida (In-painting)</label>
                    <div className="flex gap-2">
                        <textarea
                            id={`edit-prompt-${creative.id}`}
                            rows={1}
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            className="flex-grow bg-slate-700 text-slate-200 text-sm p-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-500 resize-none overflow-hidden"
                            placeholder="Ej: Haz el texto rojo..."
                            disabled={activeVariant.isGenerating || !currentImage}
                        />
                        <button
                            onClick={handleEditClick}
                            disabled={activeVariant.isGenerating || !editPrompt.trim() || !currentImage}
                            className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
                            title="Aplicar cambios"
                        >
                            <Icon name="sparkles" className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default AdDisplay;
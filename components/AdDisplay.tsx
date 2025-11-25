
import React, { useState, useCallback } from 'react';
import type { AdCreative } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';

interface AdDisplayProps {
  creative: AdCreative;
  onRegenerate: (id: string, newPrompt: string, newAspectRatio: string, newImageSize: string) => void;
  onSetCurrentImageIndex: (id: string, index: number) => void;
  onEdit: (id: string, editPrompt: string, imageSize: string) => void;
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

const AdDisplay: React.FC<AdDisplayProps> = ({ creative, onRegenerate, onSetCurrentImageIndex, onEdit }) => {
  // We use the 'imagePrompt' field to store the full Gemini 3 prompt now.
  // The 'title' and 'subtitle' fields in props are just metadata/rationale.
  const [promptContent, setPromptContent] = useState(creative.imagePrompt);
  const [aspectRatio, setAspectRatio] = useState(creative.aspectRatio);
  const [imageSize, setImageSize] = useState(creative.imageSize || '1K');
  const [editPrompt, setEditPrompt] = useState('');

  const handleRegenerateClick = useCallback(() => {
    onRegenerate(creative.id, promptContent, aspectRatio, imageSize);
  }, [onRegenerate, creative.id, promptContent, aspectRatio, imageSize]);

  const handleEditClick = useCallback(() => {
    if (editPrompt.trim()) {
        onEdit(creative.id, editPrompt, imageSize);
        setEditPrompt(''); // Clear prompt after submitting
    }
  }, [onEdit, creative.id, editPrompt, imageSize]);
  
  const currentImage = creative.images[creative.currentImageIndex];
  const currentImageUrl = currentImage?.url;
  const currentImageAspectRatio = currentImage?.aspectRatio || creative.aspectRatio;

  const handlePrev = () => {
    if (creative.currentImageIndex > 0) {
      onSetCurrentImageIndex(creative.id, creative.currentImageIndex - 1);
    }
  };

  const handleNext = () => {
    if (creative.currentImageIndex < creative.images.length - 1) {
      onSetCurrentImageIndex(creative.id, creative.currentImageIndex + 1);
    }
  };

  const buttonClass = "bg-slate-800/80 hover:bg-slate-700/80 disabled:bg-slate-900/80 disabled:text-slate-500 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-indigo-500/20 hover:border-slate-600 flex flex-col">
      {/* Concept Header */}
      <div className="px-5 py-3 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
          <div>
            <h3 className="text-slate-200 font-bold text-lg">{creative.title}</h3>
            <p className="text-slate-400 text-xs">{creative.subtitle}</p>
          </div>
      </div>

      {/* Image Container */}
      <div className={`relative bg-slate-900 flex items-center justify-center ${getAspectRatioClass(currentImageAspectRatio)}`}>
        {creative.isGenerating && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Spinner className="w-12 h-12" />
            <p className="text-slate-300 mt-2">Renderizando Diseño Completo...</p>
          </div>
        )}
        {currentImageUrl && (
          <img src={currentImageUrl} alt={creative.title} className="w-full h-full object-contain" />
        )}
        
        {/* Navigation */}
        {creative.images.length > 1 && !creative.isGenerating && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-sm p-1.5 rounded-full shadow-lg">
              <button onClick={handlePrev} disabled={creative.currentImageIndex === 0} className={buttonClass} aria-label="Imagen anterior">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
              </button>
              <span className="text-sm font-semibold text-white tabular-nums px-2">{creative.currentImageIndex + 1} / {creative.images.length}</span>
              <button onClick={handleNext} disabled={creative.currentImageIndex >= creative.images.length - 1} className={buttonClass} aria-label="Siguiente imagen">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
              </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-5 flex-grow flex flex-col space-y-4">
        
        {/* Prompt Editor */}
        <div>
             <label className="block text-xs font-medium text-slate-400 mb-1">Prompt Maestro (Instrucciones de Diseño):</label>
             <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                rows={6}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-md p-3 text-xs text-slate-300 font-mono leading-relaxed focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 scrollbar-thin scrollbar-thumb-slate-700"
                disabled={creative.isGenerating}
            />
        </div>

        {/* Regeneration Controls */}
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label htmlFor={`aspect-ratio-${creative.id}`} className="block text-xs font-medium text-slate-400 mb-1">Ratio:</label>
                <select 
                    id={`aspect-ratio-${creative.id}`}
                    value={aspectRatio} 
                    onChange={(e) => setAspectRatio(e.target.value)} 
                    disabled={creative.isGenerating} 
                    className="w-full bg-slate-700 text-slate-200 text-sm font-medium py-2 px-3 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors"
                >
                    <option value="4:3">4:3</option>
                    <option value="16:9">16:9</option>
                    <option value="1:1">1:1</option>
                    <option value="9:16">9:16</option>
                    <option value="3:4">3:4</option>
                </select>
            </div>
            <div>
                <label htmlFor={`image-size-${creative.id}`} className="block text-xs font-medium text-slate-400 mb-1">Resolución:</label>
                <select 
                    id={`image-size-${creative.id}`}
                    value={imageSize} 
                    onChange={(e) => setImageSize(e.target.value)} 
                    disabled={creative.isGenerating} 
                    className="w-full bg-slate-700 text-slate-200 text-sm font-medium py-2 px-3 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors"
                >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                </select>
            </div>
        </div>

        <button
            onClick={handleRegenerateClick}
            disabled={creative.isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 text-slate-200 font-medium py-2 px-4 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors duration-200"
        >
            <Icon name="regenerate" className="w-5 h-5"/>
            Regenerar Diseño Completo
        </button>

        {/* Edit Section */}
        <div className="pt-4 border-t border-slate-700 space-y-3">
            <div>
                <label htmlFor={`edit-prompt-${creative.id}`} className="block text-xs font-medium text-slate-400 mb-1">Edición Rápida (Ej: Cambiar color de texto, mover logo):</label>
                <textarea
                    id={`edit-prompt-${creative.id}`}
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 text-sm p-2 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
                    placeholder="Ej: Haz que el texto 'Oferta' sea de color rojo..."
                    disabled={creative.isGenerating}
                />
            </div>
            <button
                onClick={handleEditClick}
                disabled={creative.isGenerating || !editPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-medium py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
            >
                <Icon name="sparkles" className="w-5 h-5"/>
                Aplicar Cambios
            </button>
        </div>
      </div>
    </div>
  );
};

export default AdDisplay;

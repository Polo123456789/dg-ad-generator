
import React, { useState, useCallback, useEffect } from 'react';
import type { AdCreative, AdVariant } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';

interface AdDisplayProps {
  creative: AdCreative;
  onRegenerate: (id: string, ratio: string, newPrompt: string, newImageSize: string) => void;
  onEdit: (id: string, ratio: string, editPrompt: string, imageSize: string) => void;
  onSetActiveVariant: (id: string, ratio: string) => void;
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

const AdDisplay: React.FC<AdDisplayProps> = ({ creative, onRegenerate, onEdit, onSetActiveVariant }) => {
  const activeVariantKey = creative.activeVariant;
  const activeVariant = creative.variants[activeVariantKey];

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

  const currentImageUrl = activeVariant.image?.url;

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-indigo-500/20 hover:border-slate-600 flex flex-col md:flex-row h-auto min-h-[600px]">
      
      {/* Left Column: Image Area */}
      <div className="md:w-1/2 lg:w-3/5 bg-slate-900 flex flex-col border-b md:border-b-0 md:border-r border-slate-700">
        
        {/* Tabs for Aspect Ratios */}
        <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto scrollbar-hide">
            {availableRatios.map(ratio => (
                <button
                    key={ratio}
                    onClick={() => onSetActiveVariant(creative.id, ratio)}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                        ${activeVariantKey === ratio 
                            ? 'border-indigo-500 text-white bg-slate-800' 
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                >
                    {ratio}
                </button>
            ))}
        </div>

        {/* Main Image Viewport */}
        <div className="flex-grow flex items-center justify-center p-4 md:p-8 relative min-h-[400px]">
            <div className={`relative w-full max-w-full h-auto shadow-2xl ${getAspectRatioClass(activeVariantKey)}`}>
                {activeVariant.isGenerating && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                    <Spinner className="w-10 h-10" />
                    <p className="text-slate-300 mt-2 text-sm font-medium animate-pulse">Diseñando para {activeVariantKey}...</p>
                </div>
                )}
                {currentImageUrl ? (
                    <img src={currentImageUrl} alt={creative.title} className="w-full h-full object-contain bg-slate-950 rounded-lg" />
                ) : (
                     !activeVariant.isGenerating && (
                         <div className="w-full h-full bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-sm">
                             Esperando generación...
                         </div>
                     )
                )}
            </div>
        </div>
      </div>

      {/* Right Column: Controls */}
      <div className="md:w-1/2 lg:w-2/5 flex flex-col bg-slate-800/50">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-xl font-bold text-slate-100 mb-1">{creative.title}</h3>
            <p className="text-slate-400 text-sm">{creative.subtitle}</p>
          </div>

          <div className="p-6 flex-grow flex flex-col space-y-6 overflow-y-auto">
            
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
                    Regenerar Variante {activeVariantKey}
                </button>
            </div>

            {/* Edit Section */}
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
                        disabled={activeVariant.isGenerating || !activeVariant.image}
                    />
                    <button
                        onClick={handleEditClick}
                        disabled={activeVariant.isGenerating || !editPrompt.trim() || !activeVariant.image}
                        className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
                        title="Aplicar cambios"
                    >
                        <Icon name="sparkles" className="w-5 h-5"/>
                    </button>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default AdDisplay;

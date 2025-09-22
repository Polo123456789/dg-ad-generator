import React, { useState, useCallback } from 'react';
import type { AdCreative } from '../types';
import Spinner from './Spinner';
import Icon from './Icon';

interface AdDisplayProps {
  creative: AdCreative;
  onRegenerate: (id: string, newTitle: string, newSubtitle: string, newAspectRatio: string) => void;
  onSetCurrentImageIndex: (id: string, index: number) => void;
  onEdit: (id: string, editPrompt: string) => void;
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
  const [title, setTitle] = useState(creative.title);
  const [subtitle, setSubtitle] = useState(creative.subtitle);
  const [aspectRatio, setAspectRatio] = useState(creative.aspectRatio);
  const [editPrompt, setEditPrompt] = useState('');

  const handleRegenerateClick = useCallback(() => {
    onRegenerate(creative.id, title, subtitle, aspectRatio);
  }, [onRegenerate, creative.id, title, subtitle, aspectRatio]);

  const handleEditClick = useCallback(() => {
    if (editPrompt.trim()) {
        onEdit(creative.id, editPrompt);
        setEditPrompt(''); // Clear prompt after submitting
    }
  }, [onEdit, creative.id, editPrompt]);
  
  const fullPrompt = `Crea una imagen publicitaria fotorrealista y visualmente impactante para el concepto: "${creative.imagePrompt}". La imagen debe incluir de forma destacada y legible el texto del título: "${title}". También debe integrar de forma elegante el subtítulo: "${subtitle}". Es CRÍTICO que ambos textos sean perfectamente legibles. Para asegurar la legibilidad, utiliza un color de fuente que genere un alto contraste con los colores de fondo de la imagen. Si es necesario, aplica un sutil contorno o sombra al texto para que destaque sobre fondos complejos. El diseño debe ser profesional, con una composición y una iluminación excelentes, asegurando que el texto complemente la imagen.`;

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
      <div className={`relative bg-slate-900 flex items-center justify-center ${getAspectRatioClass(currentImageAspectRatio)}`}>
        {creative.isGenerating && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Spinner className="w-12 h-12" />
            <p className="text-slate-300 mt-2">Generando Imagen...</p>
          </div>
        )}
        {currentImageUrl && (
          <img src={currentImageUrl} alt={title} className="w-full h-full object-cover" />
        )}
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
      <div className="p-5 flex-grow flex flex-col">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-lg font-bold text-slate-100 border-b-2 border-slate-700 focus:border-indigo-500 outline-none transition duration-200 pb-1 mb-2"
          disabled={creative.isGenerating}
        />
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-400 border-b border-slate-700 focus:border-indigo-500 outline-none transition duration-200 pb-1 mb-4"
          disabled={creative.isGenerating}
        />
        <div className="flex-grow"></div>
        <details className="group">
          <summary className="list-none cursor-pointer flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
            <span>Ver Prompt de Imagen</span>
            <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </summary>
          <p className="mt-2 text-xs bg-slate-900/50 p-3 rounded-md border border-slate-700 text-slate-400 select-all">
            {fullPrompt}
          </p>
        </details>
        <div className="mt-4 space-y-3">
            <div>
                <label htmlFor={`aspect-ratio-${creative.id}`} className="block text-xs font-medium text-slate-400 mb-1">Regenerar con otra relación de aspecto:</label>
                <select 
                  id={`aspect-ratio-${creative.id}`}
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)} 
                  disabled={creative.isGenerating} 
                  className="w-full bg-slate-700 text-slate-200 text-sm font-medium py-2 px-3 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="4:3">4:3 (Estándar)</option>
                  <option value="16:9">16:9 (Horizontal)</option>
                  <option value="1:1">1:1 (Cuadrado)</option>
                  <option value="9:16">9:16 (Retrato)</option>
                  <option value="3:4">3:4 (Vertical)</option>
                </select>
            </div>
            <button
              onClick={handleRegenerateClick}
              disabled={creative.isGenerating}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 text-slate-200 font-medium py-2 px-4 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors duration-200"
            >
              <Icon name="regenerate" className="w-5 h-5"/>
              Regenerar Imagen
            </button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
            <div>
                <label htmlFor={`edit-prompt-${creative.id}`} className="block text-xs font-medium text-slate-400 mb-1">Edición Rápida de Imagen:</label>
                <textarea
                    id={`edit-prompt-${creative.id}`}
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 text-sm p-2 rounded-md hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-wait transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                    placeholder="Ej: añade un collar al perro, haz el cielo más azul..."
                    disabled={creative.isGenerating}
                />
            </div>
            <button
                onClick={handleEditClick}
                disabled={creative.isGenerating || !editPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-medium py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
            >
                <Icon name="sparkles" className="w-5 h-5"/>
                Editar Imagen
            </button>
        </div>
      </div>
    </div>
  );
};

export default AdDisplay;
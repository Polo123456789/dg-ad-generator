
import React, { useRef, useState } from 'react';
import Spinner from './Spinner';
import Icon from './Icon';
import InteractiveAssistant from './InteractiveAssistant';
import type { Asset } from '../types';

interface CampaignInputProps {
  onSubmit: () => void;
  isLoading: boolean;
  objective: string;
  setObjective: (value: string) => void;
  audienceAction: string;
  setAudienceAction: (value: string) => void;
  keyMessage: string;
  setKeyMessage: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  aspectRatios: string[];
  setAspectRatios: (value: string[]) => void;
  imageSize: string;
  setImageSize: (value: string) => void;
  numberOfImages: number;
  setNumberOfImages: (value: number) => void;
  styleGuideContent: string | null;
  setStyleGuideContent: (value: string | null) => void;
  attachStyleGuideDirectly: boolean;
  setAttachStyleGuideDirectly: (value: boolean) => void;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const CampaignInput: React.FC<CampaignInputProps> = ({ 
  onSubmit, 
  isLoading,
  objective,
  setObjective,
  audienceAction,
  setAudienceAction,
  keyMessage,
  setKeyMessage,
  context,
  setContext,
  aspectRatios,
  setAspectRatios,
  imageSize,
  setImageSize,
  numberOfImages,
  setNumberOfImages,
  styleGuideContent,
  setStyleGuideContent,
  attachStyleGuideDirectly,
  setAttachStyleGuideDirectly,
  assets,
  setAssets,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showInteractiveMode, setShowInteractiveMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (audienceAction.trim() && keyMessage.trim() && !isLoading && aspectRatios.length > 0) {
      onSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setStyleGuideContent(text);
      };
      reader.onerror = () => {
        console.error("Error reading file");
        setStyleGuideContent(null);
      };
      reader.readAsText(file);
    } else {
      setStyleGuideContent(null);
    }
  };

  const handleClearFile = () => {
    setStyleGuideContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Asset Handling Logic
  const processAssetFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64Data = result.split(',')[1];
      
      const newAsset: Asset = {
        id: Date.now().toString() + Math.random().toString(),
        data: base64Data,
        mimeType: file.type,
        name: file.name,
        previewUrl: result
      };

      setAssets(prev => [...prev, newAsset]);
    };
    reader.readAsDataURL(file);
  };

  const handleAssetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processAssetFile);
    }
    // Reset input so same files can be selected again
    if (assetInputRef.current) assetInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) processAssetFile(file);
      }
    }
  };

  const handleRemoveAsset = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
  };

  const toggleAspectRatio = (ratio: string) => {
      if (aspectRatios.includes(ratio)) {
          // Prevent removing the last one
          if (aspectRatios.length > 1) {
              setAspectRatios(aspectRatios.filter(r => r !== ratio));
          }
      } else {
          setAspectRatios([...aspectRatios, ratio]);
      }
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach(processAssetFile);
    }
  };
  
  const handleAssistantUpdate = (fields: {
      objective?: string;
      audienceAction?: string;
      keyMessage?: string;
      context?: string;
  }) => {
      if (fields.objective) setObjective(fields.objective);
      if (fields.audienceAction) setAudienceAction(fields.audienceAction);
      if (fields.keyMessage) setKeyMessage(fields.keyMessage);
      if (fields.context) {
          // Ensure we append to existing context if present, or just set it
          const newContext = context && context.trim() !== '' ? `${context}\n${fields.context}` : fields.context;
          setContext(newContext);
      }
  };

  const selectClassName = "w-full bg-slate-900/80 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200";
  const labelClassName = "block text-lg font-medium text-slate-200 mb-2";
  const textareaClassName = "w-full bg-slate-900/80 border border-slate-600 rounded-lg p-4 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 placeholder:text-slate-500";


  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Interactive Mode Modal */}
      {showInteractiveMode && (
          <InteractiveAssistant 
            onClose={() => setShowInteractiveMode(false)}
            onUpdateFields={handleAssistantUpdate}
          />
      )}

      <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:p-8 shadow-2xl shadow-slate-950/50 space-y-6 relative">
        
        {/* Interactive Mode Banner */}
        <div className="absolute top-0 right-0 p-6 md:p-8">
             <button
                type="button"
                onClick={() => setShowInteractiveMode(true)}
                disabled={isLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold py-2 px-4 rounded-full shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
             >
                <Icon name="sparkles" className="w-4 h-4" />
                Modo Interactivo
             </button>
        </div>

        <div>
            <label htmlFor="campaign-objective" className={labelClassName}>
              1. ¿Cuál es el objetivo principal de la campaña?
            </label>
            <p className="text-sm text-slate-400 mb-3">Define una meta clara: aumentar ventas, generar leads o mejorar el reconocimiento de la marca.</p>
            <select id="campaign-objective" value={objective} onChange={(e) => setObjective(e.target.value)} disabled={isLoading} className={selectClassName}>
                <option value="Aumentar ventas">Aumentar ventas</option>
                <option value="Generar leads">Generar leads</option>
                <option value="Mejorar el reconocimiento de la marca">Mejorar el reconocimiento de la marca</option>
            </select>
        </div>
        
        <div>
            <label htmlFor="audience-action" className={labelClassName}>
             2. ¿Qué queremos que la audiencia piense o haga?
            </label>
            <p className="text-sm text-slate-400 mb-3">Establece la acción o cambio de percepción que buscas en el público.</p>
            <textarea
              id="audience-action"
              rows={3}
              value={audienceAction}
              onChange={(e) => setAudienceAction(e.target.value)}
              className={textareaClassName}
              placeholder="Ej: Que los dueños de perros activos vean nuestro concentrado como la mejor opción para la energía de sus mascotas."
              required
              disabled={isLoading}
            />
        </div>

        <div>
            <label htmlFor="key-message" className={labelClassName}>
             3. ¿Cuál es nuestro mensaje clave?
            </label>
            <p className="text-sm text-slate-400 mb-3">El mensaje debe ser claro, convincente y resonar con la audiencia objetivo.</p>
            <textarea
              id="key-message"
              rows={3}
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              className={textareaClassName}
              placeholder="Ej: 'Energía que se nota, ingredientes que amas.' para un nuevo concentrado premium para perros."
              required
              disabled={isLoading}
            />
        </div>
        
        <div>
            <label htmlFor="context" className={labelClassName}>
             4. Contexto Adicional (Opcional)
            </label>
            <p className="text-sm text-slate-400 mb-3">Pega aquí descripciones de productos, detalles de promociones, URLs de productos, o cualquier otra información relevante.</p>
            <textarea
              id="context"
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className={textareaClassName}
              placeholder="Ej: Juguete para morder ultra resistente, hecho de caucho natural no tóxico. También puedes pegar URLs como https://mi-tienda-de-mascotas.com/productos/juguete-indestructible"
              disabled={isLoading}
            />
        </div>

        <div>
            <label htmlFor="style-guide" className={labelClassName}>
                5. Guía de Estilo (Opcional)
            </label>
            <p className="text-sm text-slate-400 mb-3">Adjunta un archivo .txt o .md con reglas de estilo (colores, tipografía, ambiente general, etc.) para aplicar a las imágenes.</p>
            <div className="flex items-center gap-4">
                <label className="flex-grow bg-slate-900/80 border border-slate-600 rounded-lg p-3 text-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition duration-200 cursor-pointer hover:bg-slate-800">
                    <input 
                        id="style-guide"
                        ref={fileInputRef}
                        type="file" 
                        accept=".txt,.md"
                        onChange={handleFileChange}
                        className="sr-only"
                        disabled={isLoading}
                    />
                    <span className="truncate">{styleGuideContent ? `Archivo cargado (${styleGuideContent.length} caracteres)` : 'Seleccionar archivo...'}</span>
                </label>
                {styleGuideContent && (
                     <button type="button" onClick={handleClearFile} className="text-slate-400 hover:text-white transition-colors p-2" aria-label="Limpiar archivo">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                         </svg>
                     </button>
                )}
            </div>
            <div className="mt-4 flex items-center">
                <input
                    id="attach-directly"
                    type="checkbox"
                    checked={attachStyleGuideDirectly}
                    onChange={(e) => setAttachStyleGuideDirectly(e.target.checked)}
                    disabled={isLoading || !styleGuideContent}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50"
                />
                <label htmlFor="attach-directly" className={`ml-3 block text-sm text-slate-300 ${isLoading || !styleGuideContent ? 'text-slate-500' : ''}`}>
                    Adjuntar guía de estilo directamente al generador de imágenes.
                </label>
            </div>
        </div>

        <div>
            <label htmlFor="assets-upload" className={labelClassName}>
                6. Assets (Opcional)
            </label>
            <p className="text-sm text-slate-400 mb-3">Adjunta logos, imágenes de productos o referencias visuales. Se usarán para generar la imagen final.</p>
            
            <div 
                className={`relative border-2 border-dashed rounded-xl p-8 transition-colors text-center cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500
                    ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'}
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onPaste={handlePaste}
                onClick={() => !isLoading && assetInputRef.current?.click()}
                tabIndex={0} // Makes div focusable for paste events
            >
                 <input 
                    id="assets-upload"
                    ref={assetInputRef}
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={handleAssetInputChange}
                    className="hidden"
                    disabled={isLoading}
                />
                <div className="flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                     <p className="font-medium">Haz clic, arrastra archivos o pega imágenes (Ctrl+V)</p>
                     <p className="text-xs mt-1">Soporta múltiples imágenes (PNG, JPG, WebP)</p>
                </div>
            </div>

            {assets.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    {assets.map((asset) => (
                        <div key={asset.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                            <img src={asset.previewUrl} alt="Asset" className="w-full h-full object-contain" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-white p-1 truncate text-center">
                                {asset.name}
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveAsset(asset.id); }}
                                className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Eliminar asset"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Relaciones de Aspecto (Formatos)</label>
                <div className="flex flex-wrap gap-2">
                    {["9:16", "1:1", "16:9", "4:3", "3:4"].map(ratio => (
                         <button
                            key={ratio}
                            type="button"
                            onClick={() => toggleAspectRatio(ratio)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                                aspectRatios.includes(ratio)
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                            }`}
                         >
                            {ratio}
                         </button>
                    ))}
                </div>
                {aspectRatios.length === 0 && <p className="text-red-500 text-xs mt-1">Selecciona al menos uno.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="image-size" className="block text-sm font-medium text-slate-300 mb-2">Resolución</label>
                    <select id="image-size" value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={isLoading} className={selectClassName}>
                        <option value="1K">1K (Rápido)</option>
                        <option value="2K">2K (Alta Calidad)</option>
                        <option value="4K">4K (Ultra HD)</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="num-images" className="block text-sm font-medium text-slate-300 mb-2">Cantidad de Conceptos</label>
                    <select id="num-images" value={numberOfImages} onChange={(e) => setNumberOfImages(Number(e.target.value))} disabled={isLoading} className={selectClassName}>
                        {[...Array(5).keys()].map(i => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !audienceAction.trim() || !keyMessage.trim() || aspectRatios.length === 0}
          className="!mt-8 w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:scale-100"
        >
          {isLoading ? (
            <>
              <Spinner className="w-5 h-5" />
              <span>Generando Variantes...</span>
            </>
          ) : (
             <>
              <Icon name="sparkles" className="w-5 h-5" />
              <span>Generar Anuncios Multiformato</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CampaignInput;

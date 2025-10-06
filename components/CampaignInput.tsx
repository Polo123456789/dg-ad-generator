import React, { useRef } from 'react';
import Spinner from './Spinner';
import Icon from './Icon';

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
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  numberOfImages: number;
  setNumberOfImages: (value: number) => void;
  styleGuideContent: string | null;
  setStyleGuideContent: (value: string | null) => void;
  attachStyleGuideDirectly: boolean;
  setAttachStyleGuideDirectly: (value: boolean) => void;
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
  aspectRatio,
  setAspectRatio,
  numberOfImages,
  setNumberOfImages,
  styleGuideContent,
  setStyleGuideContent,
  attachStyleGuideDirectly,
  setAttachStyleGuideDirectly,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (audienceAction.trim() && keyMessage.trim() && !isLoading) {
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

  const selectClassName = "w-full bg-slate-900/80 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200";
  const labelClassName = "block text-lg font-medium text-slate-200 mb-2";
  const textareaClassName = "w-full bg-slate-900/80 border border-slate-600 rounded-lg p-4 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 placeholder:text-slate-500";


  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:p-8 shadow-2xl shadow-slate-950/50 space-y-6">
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
            <p className="text-xs text-slate-500 mt-2 ml-7">Si está activado, la guía se aplica a la imagen final. Si no, influye en la creación de los prompts de imagen.</p>
        </div>

        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="aspect-ratio" className="block text-sm font-medium text-slate-300 mb-2">Relación de Aspecto de Imagen</label>
                <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading} className={selectClassName}>
                    <option value="4:3">4:3 (Estándar)</option>
                    <option value="16:9">16:9 (Horizontal)</option>
                    <option value="1:1">1:1 (Cuadrado)</option>
                    <option value="9:16">9:16 (Retrato)</option>
                    <option value="3:4">3:4 (Vertical)</option>
                </select>
            </div>
            <div>
                <label htmlFor="num-images" className="block text-sm font-medium text-slate-300 mb-2">Número de Anuncios a Generar</label>
                <select id="num-images" value={numberOfImages} onChange={(e) => setNumberOfImages(Number(e.target.value))} disabled={isLoading} className={selectClassName}>
                    {[...Array(10).keys()].map(i => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                </select>
            </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !audienceAction.trim() || !keyMessage.trim()}
          className="!mt-8 w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:scale-100"
        >
          {isLoading ? (
            <>
              <Spinner className="w-5 h-5" />
              <span>Generando...</span>
            </>
          ) : (
             <>
              <Icon name="sparkles" className="w-5 h-5" />
              <span>Generar Anuncios Para Editar</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CampaignInput;
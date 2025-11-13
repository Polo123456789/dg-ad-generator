import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { AdCreative, AdCreativeText } from './types';
import { generateAdCreatives, generateAdImage, summarizeUrlContent, editAdImage } from './services/geminiService';
import CampaignInput from './components/CampaignInput';
import AdDisplay from './components/AdDisplay';

const LOCAL_STORAGE_KEY = 'adCampaignSession';

// Helper to format error for display for internal debugging
const formatError = (e: unknown): string => {
  if (typeof e === 'string') {
    return e;
  }
  try {
    // Pretty print the error object for readability
    return JSON.stringify(e, null, 2);
  } catch {
    // Fallback for non-serializable errors
    return String(e);
  }
};


const App: React.FC = () => {
  const [adCreatives, setAdCreatives] = useState<AdCreative[] | null>(null);
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [urlSummaryForDisplay, setUrlSummaryForDisplay] = useState<string | null>(null);

  // Form state lifted from CampaignInput
  const [objective, setObjective] = useState('Aumentar ventas');
  const [audienceAction, setAudienceAction] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [context, setContext] = useState('');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [numberOfImages, setNumberOfImages] = useState(3);
  const [styleGuideContent, setStyleGuideContent] = useState<string | null>(null);
  const [attachStyleGuideDirectly, setAttachStyleGuideDirectly] = useState<boolean>(false);
  
  const importInputRef = useRef<HTMLInputElement>(null);

  // Memoize form state for useEffect dependency to prevent unnecessary re-saves
  const formState = useMemo(() => ({
    objective,
    audienceAction,
    keyMessage,
    context,
    aspectRatio,
    numberOfImages,
    styleGuideContent,
    attachStyleGuideDirectly,
  }), [
    objective,
    audienceAction,
    keyMessage,
    context,
    aspectRatio,
    numberOfImages,
    styleGuideContent,
    attachStyleGuideDirectly
  ]);

  // Effect to load session from localStorage on initial component mount
  useEffect(() => {
    try {
        const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedSession) {
            const data = JSON.parse(savedSession);

            if (data.adCreatives && data.formState && typeof data.totalCost !== 'undefined') {
                setAdCreatives(data.adCreatives);
                setTotalCost(data.totalCost);
                setUrlSummaryForDisplay(data.urlSummaryForDisplay || null);

                const {
                    objective,
                    audienceAction,
                    keyMessage,
                    context,
                    aspectRatio,
                    numberOfImages,
                    styleGuideContent,
                    attachStyleGuideDirectly,
                } = data.formState;

                setObjective(objective);
                setAudienceAction(audienceAction);
                setKeyMessage(keyMessage);
                setContext(context);
                setAspectRatio(aspectRatio);
                setNumberOfImages(numberOfImages);
                setStyleGuideContent(styleGuideContent || null);
                setAttachStyleGuideDirectly(attachStyleGuideDirectly);
            } else {
                 localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    } catch (err) {
        console.error("Error loading session from localStorage:", err);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to save session to localStorage whenever key data changes
  useEffect(() => {
    if (adCreatives && adCreatives.length > 0) {
        const sessionData = {
            adCreatives,
            totalCost,
            urlSummaryForDisplay,
            formState,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [adCreatives, totalCost, urlSummaryForDisplay, formState]);


  const handleGenerateIdeas = useCallback(async () => {
    if (!audienceAction.trim() || !keyMessage.trim()) {
      setError("Los campos '¿Qué queremos que la audiencia piense o haga?' y '¿Cuál es nuestro mensaje clave?' son obligatorios.");
      return;
    }

    setIsGeneratingInitial(true);
    setError(null);
    setAdCreatives(null);
    setUrlSummaryForDisplay(null);
    
    try {
      let urlSummary = "";
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const hasUrls = urlRegex.test(context);

      if (hasUrls) {
        // 1. Si hay URLs, obtén un resumen de su contenido primero.
        urlSummary = await summarizeUrlContent(context);
        setUrlSummaryForDisplay(urlSummary);
      }
      
      // 2. Construye el brief final para la generación de anuncios.
      let campaignBrief = `
        - Objetivo principal de la campaña: ${objective}.
        - Lo que queremos que la audiencia piense o haga: ${audienceAction}.
        - Nuestro mensaje clave: ${keyMessage}.
      `;
      if (context.trim()) {
          campaignBrief += `\n- Contexto adicional proporcionado por el usuario (descripciones, promociones, URLs, etc.): ${context}.`;
      }
      if (urlSummary.trim()) {
          campaignBrief += `\n- PUNTOS CLAVE EXTRAÍDOS DEL CONTENIDO DE LAS URLs: ${urlSummary}.`;
      }

      // 3. Genera los textos de los anuncios con el brief enriquecido.
      const textCreatives: AdCreativeText[] = await generateAdCreatives(
        campaignBrief, 
        numberOfImages,
        !attachStyleGuideDirectly ? styleGuideContent : null
      );
      
      const initialCreatives: AdCreative[] = textCreatives.map((tc, index) => ({
        ...tc,
        id: `${Date.now()}-${index}`,
        images: [],
        currentImageIndex: 0,
        isGenerating: false,
        aspectRatio: aspectRatio,
      }));
      setAdCreatives(initialCreatives);
      setIsGeneratingInitial(false);

      // 4. Genera las imágenes para cada anuncio secuencialmente.
      for (const creative of initialCreatives) {
        setAdCreatives(prev =>
            prev!.map(c => c.id === creative.id ? { ...c, isGenerating: true } : c)
        );

        try {
            const imageUrl = await generateAdImage(
              creative.title, 
              creative.subtitle, 
              creative.imagePrompt, 
              creative.aspectRatio,
              attachStyleGuideDirectly ? styleGuideContent : null
            );
            setAdCreatives(prev =>
                prev!.map(c => c.id === creative.id ? { ...c, images: [{ url: imageUrl, aspectRatio: creative.aspectRatio }], currentImageIndex: 0, isGenerating: false } : c)
            );
            setTotalCost(prevCost => prevCost + 0.04);
        } catch (e) {
            console.error(`Failed to generate image for creative ${creative.id}:`, e);
            setError(formatError(e));
            setAdCreatives(prev =>
                prev!.map(c => c.id === creative.id ? { ...c, isGenerating: false } : c)
            );
            break;
        }
      }
    } catch (e) {
      console.error(e);
      setError(formatError(e));
      setIsGeneratingInitial(false);
    }
  }, [objective, audienceAction, keyMessage, context, numberOfImages, aspectRatio, styleGuideContent, attachStyleGuideDirectly]);


  const handleRegenerateImage = useCallback(async (id: string, newTitle: string, newSubtitle: string, newAspectRatio: string) => {
    const targetCreative = adCreatives?.find(c => c.id === id);
    if (!targetCreative) return;
    
    setError(null);

    setAdCreatives(prev => 
      prev!.map(c => c.id === id ? { ...c, isGenerating: true, title: newTitle, subtitle: newSubtitle, aspectRatio: newAspectRatio } : c)
    );

    try {
      const newImageUrl = await generateAdImage(
        newTitle, 
        newSubtitle, 
        targetCreative.imagePrompt, 
        newAspectRatio,
        attachStyleGuideDirectly ? styleGuideContent : null
      );
      setAdCreatives(prev =>
        prev!.map(c => c.id === id ? { ...c, images: [...c.images, { url: newImageUrl, aspectRatio: newAspectRatio }], currentImageIndex: c.images.length, isGenerating: false } : c)
      );
      setTotalCost(prevCost => prevCost + 0.04); // Increment cost on regeneration
    } catch (e) {
      console.error(`Failed to regenerate image for creative ${id}:`, e);
      setError(formatError(e));
      setAdCreatives(prev =>
        prev!.map(c => c.id === id ? { ...c, isGenerating: false } : c)
      );
    }
  }, [adCreatives, attachStyleGuideDirectly, styleGuideContent]);

  const handleEditImage = useCallback(async (id: string, editPrompt: string) => {
    const targetCreative = adCreatives?.find(c => c.id === id);
    if (!targetCreative || targetCreative.images.length === 0) return;

    setError(null);

    const currentImage = targetCreative.images[targetCreative.currentImageIndex];
    const base64DataUrl = currentImage.url;

    // Extract mime type and base64 data from data URL
    const match = base64DataUrl.match(/^data:(image\/.*?);base64,(.*)$/);
    if (!match) {
        setError("Formato de imagen actual no válido para la edición.");
        return;
    }
    const mimeType = match[1];
    const base64ImageData = match[2];

    setAdCreatives(prev =>
        prev!.map(c => c.id === id ? { ...c, isGenerating: true } : c)
    );

    try {
        const newImageUrl = await editAdImage(base64ImageData, mimeType, editPrompt);
        setAdCreatives(prev =>
            prev!.map(c => c.id === id ? { ...c, images: [...c.images, { url: newImageUrl, aspectRatio: c.aspectRatio }], currentImageIndex: c.images.length, isGenerating: false } : c)
        );
        // setTotalCost(prevCost => prevCost + 0.01); // Optional: add cost for editing
    } catch (e) {
        console.error(`Failed to edit image for creative ${id}:`, e);
        setError(formatError(e));
        setAdCreatives(prev =>
            prev!.map(c => c.id === id ? { ...c, isGenerating: false } : c)
        );
    }
  }, [adCreatives]);

  const handleSetCurrentImageIndex = useCallback((id: string, index: number) => {
    setAdCreatives(prev => {
        if (!prev) return null;
        return prev.map(c => {
            if (c.id === id) {
                const newIndex = Math.max(0, Math.min(index, c.images.length - 1));
                return { ...c, currentImageIndex: newIndex };
            }
            return c;
        });
    });
  }, []);

  const handleGoBack = () => {
    setAdCreatives(null);
    setError(null);
    setIsGeneratingInitial(false);
    setUrlSummaryForDisplay(null);
    // Do not reset form state or totalCost
  };
  
  const handleClearSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    setAdCreatives(null);
    setError(null);
    setIsGeneratingInitial(false);
    setUrlSummaryForDisplay(null);
    setTotalCost(0);

    setObjective('Aumentar ventas');
    setAudienceAction('');
    setKeyMessage('');
    setContext('');
    setAspectRatio('3:4');
    setNumberOfImages(3);
    setStyleGuideContent(null);
    setAttachStyleGuideDirectly(false);
  };

  const handleExport = useCallback(() => {
    if (!adCreatives) return;

    const exportData = {
        adCreatives,
        totalCost,
        urlSummaryForDisplay,
        formState: {
            objective,
            audienceAction,
            keyMessage,
            context,
            aspectRatio,
            numberOfImages,
            styleGuideContent,
            attachStyleGuideDirectly,
        }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-campaign-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [adCreatives, totalCost, urlSummaryForDisplay, objective, audienceAction, keyMessage, context, aspectRatio, numberOfImages, styleGuideContent, attachStyleGuideDirectly]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const text = event.target?.result as string;
            const data = JSON.parse(text);

            // Basic validation
            if (!data.adCreatives || !data.formState || typeof data.totalCost === 'undefined') {
                throw new Error("El archivo de importación no es válido o está corrupto.");
            }
            
            // Restore state
            setAdCreatives(data.adCreatives);
            setTotalCost(data.totalCost);
            setUrlSummaryForDisplay(data.urlSummaryForDisplay || null);

            const {
                objective,
                audienceAction,
                keyMessage,
                context,
                aspectRatio,
                numberOfImages,
                styleGuideContent,
                attachStyleGuideDirectly,
            } = data.formState;

            setObjective(objective);
            setAudienceAction(audienceAction);
            setKeyMessage(keyMessage);
            setContext(context);
            setAspectRatio(aspectRatio);
            setNumberOfImages(numberOfImages);
            setStyleGuideContent(styleGuideContent || null);
            setAttachStyleGuideDirectly(attachStyleGuideDirectly);

            setError(null);
            setIsGeneratingInitial(false);

        } catch (err) {
            console.error("Error importing file:", err);
            setError(formatError(err instanceof Error ? err.message : "Error al procesar el archivo."));
        } finally {
            // Reset file input so the same file can be imported again
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };
    reader.onerror = () => {
         setError("No se pudo leer el archivo seleccionado.");
         if (importInputRef.current) {
            importInputRef.current.value = '';
         }
    };
    reader.readAsText(file);
  };


  return (
    <div className="min-h-screen text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
            <img src="https://dhgf5mcbrms62.cloudfront.net/29462425/header-fcHJMd/DVnsPlP-200x200.webp" alt="Logo de la aplicación" className="h-12 w-auto rounded-lg" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Generador de Anuncios</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right">
                <p className="text-sm text-slate-400">Costo Estimado</p>
                <p className="text-lg font-bold text-green-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}</p>
            </div>
            
            <input 
                type="file" 
                ref={importInputRef} 
                onChange={handleImport}
                accept=".json"
                className="sr-only" 
                id="import-input"
            />
            <label htmlFor="import-input" className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Importar
            </label>

            <button 
                onClick={handleExport} 
                disabled={!adCreatives}
                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
                Exportar
            </button>
            
            {adCreatives && (
              <button onClick={handleGoBack} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  Regresar
              </button>
            )}

            <button onClick={handleClearSession} title="Limpiar todo y empezar de nuevo" className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Limpiar
            </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center">
        {!adCreatives ? (
          <CampaignInput 
            onSubmit={handleGenerateIdeas} 
            isLoading={isGeneratingInitial}
            objective={objective}
            setObjective={setObjective}
            audienceAction={audienceAction}
            setAudienceAction={setAudienceAction}
            keyMessage={keyMessage}
            setKeyMessage={setKeyMessage}
            context={context}
            setContext={setContext}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            numberOfImages={numberOfImages}
            setNumberOfImages={setNumberOfImages}
            styleGuideContent={styleGuideContent}
            setStyleGuideContent={setStyleGuideContent}
            attachStyleGuideDirectly={attachStyleGuideDirectly}
            setAttachStyleGuideDirectly={setAttachStyleGuideDirectly}
            />
        ) : (
          <div className="w-full max-w-3xl mx-auto grid grid-cols-1 gap-8">
            {adCreatives.map(creative => (
              <AdDisplay key={creative.id} creative={creative} onRegenerate={handleRegenerateImage} onSetCurrentImageIndex={handleSetCurrentImageIndex} onEdit={handleEditImage} />
            ))}
          </div>
        )}

        {urlSummaryForDisplay && (
            <div className="mt-8 w-full max-w-3xl mx-auto">
                <details className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl p-4 transition-all duration-300 open:pb-5">
                    <summary className="cursor-pointer font-semibold text-slate-300 list-none flex justify-between items-center">
                        <span>Ver contexto extraído de las URLs</span>
                         <svg className="w-5 h-5 transition-transform duration-200 transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </summary>
                    <p className="mt-4 text-slate-400 whitespace-pre-wrap border-t border-slate-700 pt-4">
                        {urlSummaryForDisplay}
                    </p>
                </details>
            </div>
        )}
        
        {error && (
            <div className="mt-8 w-full max-w-4xl mx-auto">
              <p className="font-semibold text-red-400 mb-2">Error de la API (Uso Interno):</p>
              <pre className="bg-slate-950 border border-red-500/50 text-red-300 p-4 rounded-lg text-xs whitespace-pre-wrap break-words">
                {error}
              </pre>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;

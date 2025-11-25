
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { AdCreative, AdCreativeText, Asset, AdVariant } from './types';
import { generateAdCreatives, generateAdImage, summarizeUrlContent, editAdImage } from './services/geminiService';
import CampaignInput from './components/CampaignInput';
import AdDisplay from './components/AdDisplay';
import Spinner from './components/Spinner';

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
  const [aspectRatios, setAspectRatios] = useState<string[]>(['9:16', '1:1']);
  const [imageSize, setImageSize] = useState('1K');
  const [numberOfImages, setNumberOfImages] = useState(2);
  const [styleGuideContent, setStyleGuideContent] = useState<string | null>(null);
  const [attachStyleGuideDirectly, setAttachStyleGuideDirectly] = useState<boolean>(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  
  const importInputRef = useRef<HTMLInputElement>(null);

  // API Key Selection State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState<boolean>(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        // Fallback or dev environment
        setHasApiKey(true);
      }
      setCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleConnect = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            // Assume success to prevent race condition
            setHasApiKey(true);
        } catch (e) {
            console.error(e);
            if (String(e).includes("Requested entity was not found")) {
                setHasApiKey(false);
            }
        }
    }
  };

  // Memoize form state for useEffect dependency to prevent unnecessary re-saves
  const formState = useMemo(() => ({
    objective,
    audienceAction,
    keyMessage,
    context,
    aspectRatios,
    imageSize,
    numberOfImages,
    styleGuideContent,
    attachStyleGuideDirectly,
    assets
  }), [
    objective,
    audienceAction,
    keyMessage,
    context,
    aspectRatios,
    imageSize,
    numberOfImages,
    styleGuideContent,
    attachStyleGuideDirectly,
    assets
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
                    aspectRatios,
                    imageSize,
                    numberOfImages,
                    styleGuideContent,
                    attachStyleGuideDirectly,
                    assets
                } = data.formState;

                setObjective(objective);
                setAudienceAction(audienceAction);
                setKeyMessage(keyMessage);
                setContext(context);
                setAspectRatios(aspectRatios || ['9:16', '1:1']);
                setImageSize(imageSize || '1K');
                setNumberOfImages(numberOfImages);
                setStyleGuideContent(styleGuideContent || null);
                setAttachStyleGuideDirectly(attachStyleGuideDirectly);
                setAssets(assets || []);
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
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
        } catch (e) {
            console.warn("Could not save session to localStorage (likely quota exceeded due to images):", e);
        }
    }
  }, [adCreatives, totalCost, urlSummaryForDisplay, formState]);


  const handleGenerateIdeas = useCallback(async () => {
    if (!audienceAction.trim() || !keyMessage.trim()) {
      setError("Los campos '¿Qué queremos que la audiencia piense o haga?' y '¿Cuál es nuestro mensaje clave?' son obligatorios.");
      return;
    }
    if (aspectRatios.length === 0) {
        setError("Debes seleccionar al menos un formato (relación de aspecto).");
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
        urlSummary = await summarizeUrlContent(context);
        setUrlSummaryForDisplay(urlSummary);
      }
      
      let campaignBrief = `
        - Objetivo principal de la campaña: ${objective}.
        - Lo que queremos que la audiencia piense o haga: ${audienceAction}.
        - Nuestro mensaje clave: ${keyMessage}.
      `;
      if (context.trim()) {
          campaignBrief += `\n- Contexto adicional: ${context}.`;
      }
      if (urlSummary.trim()) {
          campaignBrief += `\n- PUNTOS CLAVE EXTRAÍDOS DEL WEB: ${urlSummary}.`;
      }

      // Generate Concepts with specific prompts for each requested ratio
      const textCreatives: AdCreativeText[] = await generateAdCreatives(
        campaignBrief, 
        numberOfImages,
        aspectRatios,
        styleGuideContent, 
        assets 
      );
      
      // Initialize structure
      const initialCreatives: AdCreative[] = textCreatives.map((tc, index) => {
          const variants: Record<string, AdVariant> = {};
          
          aspectRatios.forEach(ratio => {
              variants[ratio] = {
                  aspectRatio: ratio,
                  imagePrompt: tc.variantPrompts[ratio] || `Error: No prompt for ${ratio}`,
                  isGenerating: true,
                  image: undefined
              };
          });

          return {
            id: `${Date.now()}-${index}`,
            title: tc.title,
            subtitle: tc.subtitle || tc.rationale,
            rationale: tc.rationale,
            variants: variants,
            activeVariant: aspectRatios[0], // Default to first selected
            imageSize: imageSize,
          };
      });

      setAdCreatives(initialCreatives);
      setIsGeneratingInitial(false);

      // Trigger parallel generation for ALL variants across ALL creatives
      const allPromises = initialCreatives.flatMap(creative => 
          aspectRatios.map(async (ratio) => {
              const variant = creative.variants[ratio];
              try {
                  const imageUrl = await generateAdImage(
                      variant.imagePrompt, 
                      ratio,
                      creative.imageSize,
                      assets
                  );
                  
                  setAdCreatives(prev => {
                      if (!prev) return null;
                      return prev.map(c => {
                          if (c.id === creative.id) {
                              return {
                                  ...c,
                                  variants: {
                                      ...c.variants,
                                      [ratio]: {
                                          ...c.variants[ratio],
                                          image: { url: imageUrl, aspectRatio: ratio },
                                          isGenerating: false
                                      }
                                  }
                              };
                          }
                          return c;
                      });
                  });
                  setTotalCost(prevCost => prevCost + 0.14);

              } catch (e) {
                   console.error(`Failed to generate ${ratio} for creative ${creative.id}:`, e);
                   setAdCreatives(prev => {
                      if (!prev) return null;
                      return prev.map(c => {
                          if (c.id === creative.id) {
                              return {
                                  ...c,
                                  variants: {
                                      ...c.variants,
                                      [ratio]: {
                                          ...c.variants[ratio],
                                          isGenerating: false // Stop spinner even if failed
                                      }
                                  }
                              };
                          }
                          return c;
                      });
                  });
              }
          })
      );
      
      await Promise.all(allPromises);

    } catch (e) {
      console.error(e);
      setError(formatError(e));
      setIsGeneratingInitial(false);
    }
  }, [objective, audienceAction, keyMessage, context, numberOfImages, aspectRatios, imageSize, styleGuideContent, attachStyleGuideDirectly, assets]);


  const handleRegenerateVariant = useCallback(async (id: string, ratio: string, newPrompt: string, newImageSize: string) => {
    const targetCreative = adCreatives?.find(c => c.id === id);
    if (!targetCreative) return;
    
    setError(null);

    // Set generating state
    setAdCreatives(prev => 
      prev!.map(c => {
          if (c.id === id) {
              return {
                  ...c,
                  imageSize: newImageSize, // update global size preference for this card
                  variants: {
                      ...c.variants,
                      [ratio]: {
                          ...c.variants[ratio],
                          imagePrompt: newPrompt,
                          isGenerating: true
                      }
                  }
              };
          }
          return c;
      })
    );

    try {
      const newImageUrl = await generateAdImage(
        newPrompt,
        ratio,
        newImageSize,
        assets
      );

      setAdCreatives(prev => 
        prev!.map(c => {
            if (c.id === id) {
                return {
                    ...c,
                    variants: {
                        ...c.variants,
                        [ratio]: {
                            ...c.variants[ratio],
                            image: { url: newImageUrl, aspectRatio: ratio },
                            isGenerating: false
                        }
                    }
                };
            }
            return c;
        })
      );
      setTotalCost(prevCost => prevCost + 0.14);

    } catch (e) {
      console.error(`Failed to regenerate variant ${id} ${ratio}:`, e);
      setError(formatError(e));
      setAdCreatives(prev =>
        prev!.map(c => c.id === id ? { 
            ...c, 
            variants: { ...c.variants, [ratio]: { ...c.variants[ratio], isGenerating: false } } 
        } : c)
      );
    }
  }, [adCreatives, assets]);

  const handleEditVariant = useCallback(async (id: string, ratio: string, editPrompt: string, imageSize: string) => {
    const targetCreative = adCreatives?.find(c => c.id === id);
    if (!targetCreative) return;
    
    const variant = targetCreative.variants[ratio];
    if (!variant.image) return;

    setError(null);
    const base64DataUrl = variant.image.url;
    const match = base64DataUrl.match(/^data:(image\/.*?);base64,(.*)$/);
    if (!match) {
        setError("Formato de imagen actual no válido para la edición.");
        return;
    }
    const mimeType = match[1];
    const base64ImageData = match[2];

    setAdCreatives(prev => 
        prev!.map(c => c.id === id ? { 
            ...c, 
            variants: { ...c.variants, [ratio]: { ...c.variants[ratio], isGenerating: true } } 
        } : c)
    );

    try {
        const newImageUrl = await editAdImage(base64ImageData, mimeType, editPrompt, imageSize);
        setAdCreatives(prev => 
            prev!.map(c => {
                if (c.id === id) {
                    return {
                        ...c,
                        variants: {
                            ...c.variants,
                            [ratio]: {
                                ...c.variants[ratio],
                                image: { url: newImageUrl, aspectRatio: ratio },
                                isGenerating: false
                            }
                        }
                    };
                }
                return c;
            })
        );
        // setTotalCost(prevCost => prevCost + 0.14); // Optional
    } catch (e) {
        console.error(`Failed to edit image for creative ${id}:`, e);
        setError(formatError(e));
        setAdCreatives(prev =>
            prev!.map(c => c.id === id ? { 
                ...c, 
                variants: { ...c.variants, [ratio]: { ...c.variants[ratio], isGenerating: false } } 
            } : c)
        );
    }
  }, [adCreatives]);

  const handleSetActiveVariant = useCallback((id: string, ratio: string) => {
      setAdCreatives(prev => prev ? prev.map(c => c.id === id ? { ...c, activeVariant: ratio } : c) : null);
  }, []);

  const handleGoBack = () => {
    setAdCreatives(null);
    setError(null);
    setIsGeneratingInitial(false);
    setUrlSummaryForDisplay(null);
  };
  
  const handleClearSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setAdCreatives(null);
    setError(null);
    setIsGeneratingInitial(false);
    setUrlSummaryForDisplay(null);
    setTotalCost(0);
    // Reset form defaults
    setObjective('Aumentar ventas');
    setAudienceAction('');
    setKeyMessage('');
    setContext('');
    setAspectRatios(['9:16', '1:1']);
    setImageSize('1K');
    setNumberOfImages(2);
    setStyleGuideContent(null);
    setAttachStyleGuideDirectly(false);
    setAssets([]);
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
            aspectRatios,
            imageSize,
            numberOfImages,
            styleGuideContent,
            attachStyleGuideDirectly,
            assets
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
  }, [adCreatives, totalCost, urlSummaryForDisplay, objective, audienceAction, keyMessage, context, aspectRatios, imageSize, numberOfImages, styleGuideContent, attachStyleGuideDirectly, assets]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const text = event.target?.result as string;
            const data = JSON.parse(text);
            if (!data.adCreatives || !data.formState || typeof data.totalCost === 'undefined') {
                throw new Error("El archivo de importación no es válido.");
            }
            setAdCreatives(data.adCreatives);
            setTotalCost(data.totalCost);
            setUrlSummaryForDisplay(data.urlSummaryForDisplay || null);
            const { objective, audienceAction, keyMessage, context, aspectRatios, imageSize, numberOfImages, styleGuideContent, attachStyleGuideDirectly, assets } = data.formState;
            setObjective(objective);
            setAudienceAction(audienceAction);
            setKeyMessage(keyMessage);
            setContext(context);
            setAspectRatios(aspectRatios || ['9:16', '1:1']);
            setImageSize(imageSize || '1K');
            setNumberOfImages(numberOfImages);
            setStyleGuideContent(styleGuideContent || null);
            setAttachStyleGuideDirectly(attachStyleGuideDirectly);
            setAssets(assets || []);
            setError(null);
            setIsGeneratingInitial(false);
        } catch (err) {
            console.error("Error importing:", err);
            setError(formatError(err instanceof Error ? err.message : "Error."));
        } finally {
            if (importInputRef.current) importInputRef.current.value = '';
        }
    };
    reader.onerror = () => {
         setError("No se pudo leer el archivo.");
         if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  if (checkingKey) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Spinner className="w-10 h-10" /></div>;

  if (!hasApiKey) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
             <div className="max-w-md space-y-6 bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
                <div className="flex justify-center mb-4">
                    <img src="https://dhgf5mcbrms62.cloudfront.net/29462425/header-fcHJMd/DVnsPlP-200x200.webp" alt="Logo" className="h-16 w-16 rounded-xl" />
                </div>
                <h1 className="text-2xl font-bold text-white">Configuración Requerida</h1>
                <p className="text-slate-300">Para usar Gemini 3 Pro, conecta tu proyecto de Google Cloud.</p>
                <button onClick={handleConnect} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02]">Conectar Cuenta</button>
             </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
            <img src="https://dhgf5mcbrms62.cloudfront.net/29462425/header-fcHJMd/DVnsPlP-200x200.webp" alt="Logo" className="h-12 w-auto rounded-lg" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Generador de Anuncios <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full align-middle ml-2">PRO</span></h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right">
                <p className="text-sm text-slate-400">Costo Estimado</p>
                <p className="text-lg font-bold text-green-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}</p>
            </div>
            
            <input type="file" ref={importInputRef} onChange={handleImport} accept=".json" className="sr-only" id="import-input" />
            <label htmlFor="import-input" className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Importar</label>
            <button onClick={handleExport} disabled={!adCreatives} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed">Exportar</button>
            {adCreatives && <button onClick={handleGoBack} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Regresar</button>}
            <button onClick={handleClearSession} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Limpiar</button>
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
            aspectRatios={aspectRatios}
            setAspectRatios={setAspectRatios}
            imageSize={imageSize}
            setImageSize={setImageSize}
            numberOfImages={numberOfImages}
            setNumberOfImages={setNumberOfImages}
            styleGuideContent={styleGuideContent}
            setStyleGuideContent={setStyleGuideContent}
            attachStyleGuideDirectly={attachStyleGuideDirectly}
            setAttachStyleGuideDirectly={setAttachStyleGuideDirectly}
            assets={assets}
            setAssets={setAssets}
            />
        ) : (
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 gap-12">
            {adCreatives.map(creative => (
              <AdDisplay 
                key={creative.id} 
                creative={creative} 
                onRegenerate={handleRegenerateVariant} 
                onEdit={handleEditVariant}
                onSetActiveVariant={handleSetActiveVariant}
              />
            ))}
          </div>
        )}

        {urlSummaryForDisplay && (
            <div className="mt-8 w-full max-w-3xl mx-auto">
                <details className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl p-4 transition-all duration-300 open:pb-5">
                    <summary className="cursor-pointer font-semibold text-slate-300 list-none flex justify-between items-center">
                        <span>Ver contexto extraído de las URLs</span>
                         <svg className="w-5 h-5 transition-transform duration-200 transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </summary>
                    <p className="mt-4 text-slate-400 whitespace-pre-wrap border-t border-slate-700 pt-4">{urlSummaryForDisplay}</p>
                </details>
            </div>
        )}
        
        {error && (
            <div className="mt-8 w-full max-w-4xl mx-auto">
              <p className="font-semibold text-red-400 mb-2">Error de la API (Uso Interno):</p>
              <pre className="bg-slate-950 border border-red-500/50 text-red-300 p-4 rounded-lg text-xs whitespace-pre-wrap break-words">{error}</pre>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;

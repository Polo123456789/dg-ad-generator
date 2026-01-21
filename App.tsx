
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { AdCreative, AdCreativeText, Asset, AdVariant, AdImage } from './types';
import { generateAdCreatives, generateAdImage, summarizeUrlContent, editAdImage, generatePreviewImage } from './services/geminiService';
import CampaignInput from './components/CampaignInput';
import AdDisplay from './components/AdDisplay';
import Spinner from './components/Spinner';
import Icon from './components/Icon';
import JSZip from 'jszip';

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

  // Generate More State
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [moreCount, setMoreCount] = useState<number>(1);

  // Form state lifted from CampaignInput
  const [objective, setObjective] = useState('Aumentar ventas');
  const [audienceAction, setAudienceAction] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [context, setContext] = useState('');
  const [aspectRatios, setAspectRatios] = useState<string[]>(['1:1', '16:9', '3:4']);
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
        // Fallback for dev environment
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
            // Fix: Explicitly cast JSON.parse result to any to avoid "unknown" type errors during property access
            const data = JSON.parse(savedSession) as any;

            if (data.adCreatives && data.formState && typeof data.totalCost !== 'undefined') {
                // MIGRATION: Ensure creatives have history structure if loaded from old session
                // Use explicit any casts to handle potential unknown types from JSON.parse
                const migratedCreatives = (data.adCreatives as any[]).map((c: any) => {
                    const migratedVariants: Record<string, AdVariant> = {};
                    const variants = (c.variants || {}) as Record<string, any>;
                    Object.keys(variants).forEach(key => {
                        const v = variants[key] as any;
                        // If it has 'image' but no 'history', migrate it
                        if (v.image && (!v.history || v.history.length === 0)) {
                            migratedVariants[key] = {
                                ...v,
                                history: [{ ...v.image, isPreview: false }], // Assume old ones are not preview
                                currentHistoryIndex: 0
                            } as AdVariant;
                        } else if (!v.history) {
                             migratedVariants[key] = {
                                ...v,
                                history: [],
                                currentHistoryIndex: -1
                            } as AdVariant;
                        } else {
                            migratedVariants[key] = v as AdVariant;
                        }
                    });
                    return { ...c, variants: migratedVariants, status: (c as any).status || 'completed' };
                });

                setAdCreatives(migratedCreatives);
                setTotalCost(data.totalCost);
                setUrlSummaryForDisplay(data.urlSummaryForDisplay || null);

                // Use explicit any cast for form state loading
                const fs = data.formState as any;
                setObjective(fs.objective || 'Aumentar ventas');
                setAudienceAction(fs.audienceAction || '');
                setKeyMessage(fs.keyMessage || '');
                setContext(fs.context || '');
                setAspectRatios(fs.aspectRatios || ['9:16', '1:1']);
                setImageSize(fs.imageSize || '1K');
                setNumberOfImages(fs.numberOfImages || 2);
                setStyleGuideContent(fs.styleGuideContent || null);
                setAttachStyleGuideDirectly(fs.attachStyleGuideDirectly || false);
                setAssets(fs.assets || []);
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
    } else if (adCreatives === null && !isGeneratingInitial) {
        // If explicitly cleared (null) and not generating, we might want to clear local storage too
    }
  }, [adCreatives, totalCost, urlSummaryForDisplay, formState, isGeneratingInitial]);


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
      
      const primaryRatio = aspectRatios[0];

      // Initialize structure
      const initialCreatives: AdCreative[] = textCreatives.map((tc, index) => {
          const variants: Record<string, AdVariant> = {};
          
          aspectRatios.forEach(ratio => {
              variants[ratio] = {
                  aspectRatio: ratio,
                  imagePrompt: tc.variantPrompts[ratio] || `Error: No prompt for ${ratio}`,
                  isGenerating: ratio === primaryRatio, // Only first one is generating (preview)
                  history: [],
                  currentHistoryIndex: -1,
              };
          });

          return {
            id: `${Date.now()}-${index}`,
            title: tc.title,
            subtitle: tc.subtitle || tc.rationale,
            rationale: tc.rationale,
            variants: variants,
            activeVariant: primaryRatio, // Default to first selected
            imageSize: imageSize,
            status: 'generating_preview' // Start in preview generation mode
          };
      });

      setAdCreatives(initialCreatives);
      setIsGeneratingInitial(false);

      // Trigger parallel PREVIEW generation for the FIRST variant ONLY using Imagen 4
      const previewPromises = initialCreatives.map(async (creative) => {
          const ratio = primaryRatio;
          const variant = creative.variants[ratio];
          try {
              // Use Imagen 4 for fast preview
              const imageUrl = await generatePreviewImage(variant.imagePrompt, ratio);
              
              setAdCreatives(prev => {
                  if (!prev) return null;
                  return prev.map(c => {
                      if (c.id === creative.id) {
                          return {
                              ...c,
                              status: 'preview_ready',
                              variants: {
                                  ...c.variants,
                                  [ratio]: {
                                      ...c.variants[ratio],
                                      history: [{ url: imageUrl, aspectRatio: ratio, isPreview: true }],
                                      currentHistoryIndex: 0,
                                      isGenerating: false,
                                  }
                              }
                          };
                      }
                      return c;
                  });
              });
              // Preview is cheaper
              setTotalCost(prevCost => prevCost + 0.01); 

          } catch (e) {
               console.error(`Failed to generate preview for creative ${creative.id}:`, e);
               setAdCreatives(prev => {
                  if (!prev) return null;
                  return prev.map(c => {
                      if (c.id === creative.id) {
                          return {
                              ...c,
                              status: 'preview_ready', // Allow user to try full generation
                              variants: {
                                  ...c.variants,
                                  [ratio]: {
                                      ...c.variants[ratio],
                                      isGenerating: false
                                  }
                              }
                          };
                      }
                      return c;
                  });
              });
          }
      });
      
      await Promise.all(previewPromises);

    } catch (e) {
      console.error(e);
      setError(formatError(e));
      setIsGeneratingInitial(false);
    }
  }, [objective, audienceAction, keyMessage, context, numberOfImages, aspectRatios, imageSize, styleGuideContent, attachStyleGuideDirectly, assets]);


  // HANDLE GENERATE MORE functionality
  const handleGenerateMore = useCallback(async () => {
    if (!audienceAction.trim() || !keyMessage.trim()) return;
    
    setIsGeneratingMore(true);
    setError(null);

    try {
        let urlSummary = urlSummaryForDisplay || "";
        
        // Reconstruct brief using current form state
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

        // Generate additional concepts
        const textCreatives: AdCreativeText[] = await generateAdCreatives(
            campaignBrief, 
            moreCount,
            aspectRatios,
            styleGuideContent, 
            assets 
        );

        const primaryRatio = aspectRatios[0];
        
        // Map new text creatives to AdCreative objects
        const newCreatives: AdCreative[] = textCreatives.map((tc, index) => {
             const variants: Record<string, AdVariant> = {};
             aspectRatios.forEach(ratio => {
                variants[ratio] = {
                    aspectRatio: ratio,
                    imagePrompt: tc.variantPrompts[ratio] || `Error: No prompt for ${ratio}`,
                    isGenerating: ratio === primaryRatio, 
                    history: [],
                    currentHistoryIndex: -1,
                };
             });

            return {
                id: `${Date.now()}-${index}-added`, // Unique ID suffix
                title: tc.title,
                subtitle: tc.subtitle || tc.rationale,
                rationale: tc.rationale,
                variants: variants,
                activeVariant: primaryRatio,
                imageSize: imageSize,
                status: 'generating_preview'
            };
        });

        // Append to existing creatives
        setAdCreatives(prev => prev ? [...prev, ...newCreatives] : newCreatives);

        // Trigger previews for new items
        const previewPromises = newCreatives.map(async (creative) => {
            const ratio = primaryRatio;
            const variant = creative.variants[ratio];
            try {
                const imageUrl = await generatePreviewImage(variant.imagePrompt, ratio);
                
                setAdCreatives(prev => {
                    if (!prev) return null;
                    return prev.map(c => {
                        if (c.id === creative.id) {
                            return {
                                ...c,
                                status: 'preview_ready',
                                variants: {
                                    ...c.variants,
                                    [ratio]: {
                                        ...c.variants[ratio],
                                        history: [{ url: imageUrl, aspectRatio: ratio, isPreview: true }],
                                        currentHistoryIndex: 0,
                                        isGenerating: false,
                                    }
                                }
                            };
                        }
                        return c;
                    });
                });
                setTotalCost(prevCost => prevCost + 0.01); 
            } catch (e) {
                 console.error(`Failed to generate preview for creative ${creative.id}:`, e);
                 setAdCreatives(prev => {
                    if (!prev) return null;
                    return prev.map(c => {
                        if (c.id === creative.id) {
                            return {
                                ...c,
                                status: 'preview_ready', 
                                variants: {
                                    ...c.variants,
                                    [ratio]: {
                                        ...c.variants[ratio],
                                        isGenerating: false
                                    }
                                }
                            };
                        }
                        return c;
                    });
                });
            }
        });

        await Promise.all(previewPromises);

    } catch (e) {
        console.error(e);
        setError(formatError(e));
    } finally {
        setIsGeneratingMore(false);
    }
}, [objective, audienceAction, keyMessage, context, moreCount, aspectRatios, imageSize, styleGuideContent, assets, urlSummaryForDisplay]);


  // Handler to Approve a Concept and Trigger Full High-Quality Generation
  const handleApproveCreative = useCallback(async (creativeId: string) => {
    const creative = adCreatives?.find(c => c.id === creativeId);
    if (!creative) return;

    // Update status to full generation and mark all variants as generating
    setAdCreatives(prev => prev!.map(c => {
        if (c.id === creativeId) {
            const newVariants = { ...c.variants };
            Object.keys(newVariants).forEach(key => {
                newVariants[key] = { ...newVariants[key], isGenerating: true };
            });

            return {
                ...c,
                status: 'generating_full',
                variants: newVariants
            };
        }
        return c;
    }));

    // Trigger Generation for ALL ratios using Gemini 3 Pro
    const ratiosToGenerate = Object.keys(creative.variants);
    
    const promises = ratiosToGenerate.map(async (ratio) => {
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
                    if (c.id === creativeId) {
                        const existingHistory = c.variants[ratio].history;
                        const newImage: AdImage = { url: imageUrl, aspectRatio: ratio, isPreview: false };
                        
                        return {
                            ...c,
                            variants: {
                                ...c.variants,
                                [ratio]: {
                                    ...c.variants[ratio],
                                    history: [...existingHistory, newImage],
                                    currentHistoryIndex: existingHistory.length, // Point to new image
                                    isGenerating: false,
                                }
                            }
                        };
                    }
                    return c;
                });
            });
            setTotalCost(prevCost => prevCost + 0.14);

        } catch (e) {
            console.error(`Failed to generate full quality ${ratio} for creative ${creativeId}:`, e);
             setAdCreatives(prev => {
                if (!prev) return null;
                return prev.map(c => {
                    if (c.id === creativeId) {
                        return {
                            ...c,
                            variants: {
                                ...c.variants,
                                [ratio]: {
                                    ...c.variants[ratio],
                                    isGenerating: false
                                }
                            }
                        };
                    }
                    return c;
                });
            });
        }
    });

    await Promise.all(promises);

    setAdCreatives(prev => prev!.map(c => {
        if (c.id === creativeId) {
            return { ...c, status: 'completed' };
        }
        return c;
    }));

  }, [adCreatives, assets]);


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
                const existingHistory = c.variants[ratio].history;
                const newImage: AdImage = { url: newImageUrl, aspectRatio: ratio, isPreview: false };

                return {
                    ...c,
                    variants: {
                        ...c.variants,
                        [ratio]: {
                            ...c.variants[ratio],
                            history: [...existingHistory, newImage],
                            currentHistoryIndex: existingHistory.length,
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
    const currentImage = variant.history[variant.currentHistoryIndex];
    if (!currentImage) return;

    setError(null);
    const base64DataUrl = currentImage.url;
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
                    const existingHistory = c.variants[ratio].history;
                    const newImage: AdImage = { url: newImageUrl, aspectRatio: ratio, isPreview: false };

                    return {
                        ...c,
                        variants: {
                            ...c.variants,
                            [ratio]: {
                                ...c.variants[ratio],
                                history: [...existingHistory, newImage],
                                currentHistoryIndex: existingHistory.length,
                                isGenerating: false
                            }
                        }
                    };
                }
                return c;
            })
        );
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

  const handleNavigateHistory = useCallback((id: string, ratio: string, direction: 'prev' | 'next') => {
      setAdCreatives(prev => prev ? prev.map(c => {
          if (c.id === id) {
              const variant = c.variants[ratio];
              let newIndex = variant.currentHistoryIndex;
              if (direction === 'prev') {
                  newIndex = Math.max(0, newIndex - 1);
              } else {
                  newIndex = Math.min(variant.history.length - 1, newIndex + 1);
              }
              return {
                  ...c,
                  variants: {
                      ...c.variants,
                      [ratio]: { ...variant, currentHistoryIndex: newIndex }
                  }
              };
          }
          return c;
      }) : null);
  }, []);

  const handleDiscardCreative = useCallback((id: string) => {
      setAdCreatives(prev => {
          if (!prev) return null;
          const remaining = prev.filter(c => c.id !== id);
          return remaining.length > 0 ? remaining : null;
      });
  }, []);

  const handleDownloadZip = useCallback(async (id: string) => {
      const creative = adCreatives?.find(c => c.id === id);
      if (!creative) return;

      try {
          const zip = new JSZip();
          // Normalize concept name for filenames
          const conceptSlug = creative.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'ad-concept';
          
          // Add Markdown info file
          const textContent = `
# ${creative.title}
**Subtítulo:** ${creative.subtitle}

## Estrategia Creativa (Rationale)
${creative.rationale}

---

## Prompts Utilizados por Formato
${Object.entries(creative.variants).map(([ratio, variant]: [string, AdVariant]) => `
### Formato ${ratio}
\`\`\`text
${variant.imagePrompt}
\`\`\`
`).join('\n')}
          `.trim();
          
          zip.file(`${conceptSlug}.md`, textContent);

          // Add images directly to the root of the ZIP
          Object.entries(creative.variants).forEach(([ratio, variant]: [string, AdVariant]) => {
              const currentImage = variant.history[variant.currentHistoryIndex];
              if (currentImage && currentImage.url.startsWith('data:image')) {
                  const matches = currentImage.url.match(/^data:image\/(.*?);base64,(.*)$/);
                  if (matches) {
                      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                      const data = matches[2];
                      // Name format: concept-name-9-16.jpg
                      const filename = `${conceptSlug}-${ratio.replace(':', '-')}.${ext}`;
                      zip.file(filename, data, { base64: true });
                  }
              }
          });

          // Generate zip - Corrected from 'target' to 'type'
          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          
          // Trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = `${conceptSlug}-assets.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

      } catch (err) {
          console.error("Error zipping assets:", err);
          setError(`Error al comprimir los archivos: ${err instanceof Error ? err.message : String(err)}`);
      }
  }, [adCreatives]);

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
            // Fix: Explicitly cast JSON.parse result to any to avoid "unknown" type errors during property access
            const data = JSON.parse(text) as any;
            if (!data.adCreatives || !data.formState || typeof data.totalCost === 'undefined') {
                throw new Error("El archivo de importación no es válido.");
            }
            // Migration logic on import
            // Use explicit any casts to handle unknown property access from imported JSON
            const migratedCreatives = (data.adCreatives as any[]).map((c: any) => {
                const migratedVariants: Record<string, AdVariant> = {};
                const variants = (c.variants || {}) as Record<string, any>;
                Object.keys(variants).forEach(key => {
                    const v = variants[key] as any;
                    if (v.image && (!v.history || v.history.length === 0)) {
                        migratedVariants[key] = {
                            ...v,
                            history: [{ ...v.image, isPreview: false }],
                            currentHistoryIndex: 0
                        } as AdVariant;
                    } else if (!v.history) {
                         migratedVariants[key] = {
                            ...v,
                            history: [],
                            currentHistoryIndex: -1
                        } as AdVariant;
                    } else {
                        migratedVariants[key] = v as AdVariant;
                    }
                });
                return { ...c, variants: migratedVariants, status: (c as any).status || 'completed' };
            });

            setAdCreatives(migratedCreatives);
            setTotalCost(data.totalCost);
            setUrlSummaryForDisplay(data.urlSummaryForDisplay || null);
            
            // Use explicit any cast for imported form state
            const fs = data.formState as any;
            setObjective(fs.objective || 'Aumentar ventas');
            setAudienceAction(fs.audienceAction || '');
            setKeyMessage(fs.keyMessage || '');
            setContext(fs.context || '');
            setAspectRatios(fs.aspectRatios || ['9:16', '1:1']);
            setImageSize(fs.imageSize || '1K');
            setNumberOfImages(fs.numberOfImages || 2);
            setStyleGuideContent(fs.styleGuideContent || null);
            setAttachStyleGuideDirectly(fs.attachStyleGuideDirectly || false);
            setAssets(fs.assets || []);
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
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-12">
            <div className="grid grid-cols-1 gap-12">
                {adCreatives.map(creative => (
                <AdDisplay 
                    key={creative.id} 
                    creative={creative} 
                    onRegenerate={handleRegenerateVariant} 
                    onEdit={handleEditVariant}
                    onSetActiveVariant={handleSetActiveVariant}
                    onApprove={handleApproveCreative}
                    onNavigateHistory={handleNavigateHistory}
                    onDiscard={handleDiscardCreative}
                    onDownloadZip={handleDownloadZip}
                />
                ))}
            </div>

            <div className="bg-slate-800/40 border border-slate-700 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                <h3 className="text-xl font-semibold text-slate-200">¿Necesitas más opciones?</h3>
                <p className="text-slate-400 max-w-md">Genera conceptos adicionales usando la misma información del formulario.</p>
                
                <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                    <span className="text-sm text-slate-300 pl-2">Cantidad:</span>
                    <select 
                        value={moreCount} 
                        onChange={(e) => setMoreCount(Number(e.target.value))}
                        className="bg-slate-800 text-white border border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        disabled={isGeneratingMore}
                    >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                    </select>
                    <button 
                        onClick={handleGenerateMore}
                        disabled={isGeneratingMore}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGeneratingMore ? <Spinner className="w-4 h-4"/> : <Icon name="sparkles" className="w-4 h-4"/>}
                        Generar Más
                    </button>
                </div>
            </div>
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

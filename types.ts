
export interface AdImage {
  url: string;
  aspectRatio: string;
  isPreview: boolean; // Indicates if this specific image is a preview (Imagen 4)
}

export interface AdVariant {
  aspectRatio: string;
  imagePrompt: string;
  // History of generated images for this variant (carousel)
  history: AdImage[];
  currentHistoryIndex: number; 
  isGenerating: boolean;
}

export interface AdCreative {
  id: string;
  title: string;
  subtitle: string;
  rationale: string;
  variants: Record<string, AdVariant>; // Keyed by ratio e.g. "9:16"
  activeVariant: string; // The currently selected ratio tab
  imageSize: string; // Shared setting
  status: 'generating_text' | 'generating_preview' | 'preview_ready' | 'generating_full' | 'completed'; // Workflow status
}

export interface AdCreativeText {
  title: string;
  subtitle:string;
  rationale: string;
  // Dynamic map of prompts keyed by ratio "16:9": "prompt..."
  variantPrompts: Record<string, string>; 
}

export interface Asset {
  id: string;
  data: string; // Base64 string without prefix for API
  mimeType: string;
  name: string; // Filename to help the AI identify the asset
  previewUrl: string; // Full data URL for UI display
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

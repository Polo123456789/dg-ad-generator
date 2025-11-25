
export interface AdImage {
  url: string;
  aspectRatio: string;
}

export interface AdVariant {
  aspectRatio: string;
  imagePrompt: string; // The specific prompt for this ratio
  image?: AdImage;
  isGenerating: boolean;
  isPreview?: boolean; // New flag for Imagen 4 previews
}

export interface AdCreative {
  id: string;
  title: string;
  subtitle: string;
  rationale: string;
  variants: Record<string, AdVariant>; // Keyed by ratio e.g. "9:16"
  activeVariant: string; // The currently selected ratio tab
  imageSize: string; // Shared setting
  status: 'generating_text' | 'generating_preview' | 'preview_ready' | 'generating_full' | 'completed'; // New status workflow
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

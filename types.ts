
export interface AdImage {
  url: string;
  aspectRatio: string;
}

export interface AdCreative {
  id: string;
  title: string; // Used for UI reference/editing intention
  subtitle: string; // Used for UI reference/editing intention
  imagePrompt: string; // This is now the Full Gemini 3 prompt
  images: AdImage[];
  currentImageIndex: number;
  isGenerating: boolean;
  aspectRatio: string;
  imageSize: string;
}

export interface AdCreativeText {
  title: string;
  subtitle:string;
  gemini3Prompt: string; // The complex structured prompt
  rationale: string; // Why this design?
}

export interface Asset {
  id: string;
  data: string; // Base64 string without prefix for API
  mimeType: string;
  name: string; // Filename to help the AI identify the asset
  previewUrl: string; // Full data URL for UI display
}


export interface AdImage {
  url: string;
  aspectRatio: string;
}

export interface AdCreative {
  id: string;
  title: string;
  subtitle: string;
  imagePrompt: string;
  images: AdImage[];
  currentImageIndex: number;
  isGenerating: boolean;
  aspectRatio: string;
}

export interface AdCreativeText {
  title: string;
  subtitle:string;
  imagePrompt: string;
}
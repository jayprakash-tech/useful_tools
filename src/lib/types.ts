export type ToolConfig = Record<string, any>;

export interface Tool {
  slug: string;
  name: string;
  short: string;
  long: string;
  cat: string;
  icon: string;
  panel: string;
  config?: ToolConfig;
  /** accepted input mime types (dropzone) */
  accept?: string;
  multiple?: boolean;
  popular?: boolean;
  formats: string[];
  features: string[];
  steps: string[];
  benefits: string[];
  faq: [string, string][];
  related: string[];
}

export interface Category {
  slug: string;
  name: string;
  short: string;
  icon: string;
}

export interface BatchItem {
  id: string;
  file: File;
  url: string;
  status: "pending" | "working" | "done" | "error";
  outBlob?: Blob;
  outName?: string;
  error?: string;
  note?: string;
}

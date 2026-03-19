// Import system types — Area 3

export type ImportJobStatus =
  | 'queued'
  | 'parsing'
  | 'chunking'
  | 'ready_for_ai'
  | 'processing'
  | 'review'
  | 'importing'
  | 'complete'
  | 'error';

export type ImportSourceType =
  | 'twitter'
  | 'instagram'
  | 'whatsapp'
  | 'text'
  | 'pdf'
  | 'photo'
  | 'engram_backup'
  | 'unknown';

export interface ImportChunk {
  id: string;
  jobId: string;
  index: number;
  text: string;
  /** Optional context header injected when this chunk continues a prior thread */
  contextHeader?: string;
  tokenEstimate: number;
  startOffset: number;
  endOffset: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedEngramItem {
  id: string;
  chunkId: string;
  title: string;
  content: string;
  cloudType?: string;
  date?: string;
  tags?: string[];
  /** Raw redacted fields before AI expansion */
  redactionMap?: Record<string, string>;
  confidence: number;
  selected: boolean;
}

export interface ImportJob {
  id: string;
  sourceType: ImportSourceType;
  fileName: string;
  fileSize: number;
  status: ImportJobStatus;
  /** 0–100 progress percentage */
  progress: number;
  chunks: ImportChunk[];
  extractedItems: ExtractedEngramItem[];
  errors: string[];
  createdAt: string;
  completedAt?: string;
  /** Preview stats populated after initial parse */
  preview?: {
    messageCount?: number;
    dateRange?: { from: string; to: string };
    estimatedChunks?: number;
    detectedFormat?: string;
  };
}

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ImportSourceType } from '../../engine/import/types';

const SOURCE_LABELS: Record<ImportSourceType, string> = {
  twitter: 'Twitter Archive',
  instagram: 'Instagram Archive',
  whatsapp: 'WhatsApp Export',
  text: 'Text / Markdown',
  pdf: 'PDF Document',
  photo: 'Photo (EXIF)',
  engram_backup: 'Engram Backup',
  unknown: 'Unknown Format',
};

const SOURCE_ICONS: Record<ImportSourceType, string> = {
  twitter: '𝕏',
  instagram: '📸',
  whatsapp: '💬',
  text: '📝',
  pdf: '📄',
  photo: '🖼',
  engram_backup: '🗂',
  unknown: '❓',
};

interface Props {
  onFileDrop: (file: File) => void;
  detectedType: ImportSourceType | null;
  isLoading: boolean;
}

export default function ImportDropZone({ onFileDrop, detectedType, isLoading }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFileDrop(accepted[0]);
    },
    [onFileDrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isLoading,
    accept: {
      'application/zip': ['.zip'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.tiff'],
      'application/json': ['.json', '.engram'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
        ${isDragActive
          ? 'border-accent-gold bg-accent-gold/5 scale-[1.01]'
          : 'border-border hover:border-accent-gold/50 hover:bg-surface/60'
        }
        ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />

      {detectedType ? (
        <div className="space-y-2">
          <div className="text-4xl">{SOURCE_ICONS[detectedType]}</div>
          <p className="text-accent-gold font-semibold text-lg">{SOURCE_LABELS[detectedType]}</p>
          <p className="text-text-secondary text-sm">Drop another file to replace</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-4xl opacity-40">📥</div>
          {isDragActive ? (
            <p className="text-accent-gold font-medium">Release to import</p>
          ) : (
            <>
              <p className="text-text-primary font-medium">Drop your file here</p>
              <p className="text-text-secondary text-sm">or click to browse</p>
            </>
          )}
          <p className="text-text-secondary text-xs mt-2 leading-relaxed">
            Supports: Twitter archive (.zip), Instagram archive (.zip),<br />
            WhatsApp export (.txt), Text / Markdown (.txt, .md),<br />
            PDF (.pdf), Photos (.jpg, .png, .heic), Engram backup (.json, .engram)
          </p>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
          <div className="flex items-center gap-2 text-accent-gold">
            <div className="w-4 h-4 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Analysing file…</span>
          </div>
        </div>
      )}
    </div>
  );
}

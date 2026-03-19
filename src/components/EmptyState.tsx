import type { CloudType } from '../types/engram';

const EMPTY_MESSAGES: Record<CloudType, string> = {
  memory: 'No memories captured yet. What moments shaped you?',
  knowledge: 'No knowledge stored. What have you learned?',
  belief: 'No beliefs recorded. What do you hold true?',
  value: 'No values defined. What matters most to you?',
  skill: 'No skills tracked. What can you do?',
  goal: 'No goals set. What are you reaching toward?',
  reflection: 'No reflections written. What are you thinking about?',
};

interface EmptyStateProps {
  cloudType: CloudType | null;
  isSearch?: boolean;
  onCreateClick?: () => void;
}

export default function EmptyState({ cloudType, isSearch, onCreateClick }: EmptyStateProps) {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-4">🔍</span>
        <p className="text-text-secondary text-sm">No engrams match your search.</p>
        <p className="text-text-secondary/60 text-xs mt-1">Try different keywords.</p>
      </div>
    );
  }

  const message = cloudType
    ? EMPTY_MESSAGES[cloudType]
    : 'Select a cloud type to explore, or create your first engram.';

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl mb-4">{cloudType ? '☁️' : '🧭'}</span>
      <p className="text-text-secondary text-sm max-w-xs">{message}</p>
      {onCreateClick && (
        <button
          onClick={onCreateClick}
          className="mt-4 px-4 py-2 bg-accent-gold/10 text-accent-gold border border-accent-gold/30 rounded-lg text-sm hover:bg-accent-gold/20 transition-colors"
        >
          + Create Engram
        </button>
      )}
    </div>
  );
}

// Review card — Area 4.9
import { useState } from 'react';
import type { ExtractedEngramItem } from '../../engine/import/types';

interface Props {
  item: ExtractedEngramItem;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (patch: Partial<ExtractedEngramItem>) => void;
  isActive: boolean;
  onActivate: () => void;
}

const CLOUD_ICONS: Record<string, string> = {
  memory: '💭', knowledge: '📚', belief: '🧭', value: '⭐',
  skill: '🛠', goal: '🎯', reflection: '🪞',
};
const CLOUD_LABELS: Record<string, string> = {
  memory: 'Memory', knowledge: 'Knowledge', belief: 'Belief', value: 'Value',
  skill: 'Skill', goal: 'Goal', reflection: 'Reflection',
};
const CLOUD_TYPES = ['memory', 'knowledge', 'belief', 'value', 'skill', 'goal', 'reflection'] as const;

export default function ReviewCard({ item, onAccept, onReject, onEdit, isActive, onActivate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(item.hasSensitiveContent ?? false);

  // Edit state
  const [editTitle, setEditTitle] = useState(item.editedTitle ?? item.title);
  const [editContent, setEditContent] = useState(item.editedContent ?? item.content);
  const [editCloudType, setEditCloudType] = useState(item.editedCloudType ?? item.cloudType ?? 'memory');
  const [editDate, setEditDate] = useState(item.editedDate ?? item.date ?? '');
  const [editTags, setEditTags] = useState((item.editedTags ?? item.tags ?? []).join(', '));

  const cloudType = item.editedCloudType ?? item.cloudType ?? 'memory';
  const title = item.editedTitle ?? item.title;
  const content = item.editedContent ?? item.content;
  const date = item.editedDate ?? item.date;
  const tags = item.editedTags ?? item.tags ?? [];
  const confidence = item.confidence;

  const confidenceBadge =
    confidence >= 0.8
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
      : confidence >= 0.5
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
      : 'bg-red-500/15 text-red-400 border-red-500/20';

  const decision = item.reviewDecision;
  const cardBorder =
    decision === 'accept'
      ? 'border-emerald-500/40'
      : decision === 'reject'
      ? 'border-red-500/30 opacity-60'
      : isActive
      ? 'border-indigo-500/50'
      : 'border-indigo-500/20';

  const handleSaveEdit = () => {
    onEdit({
      editedTitle: editTitle,
      editedContent: editContent,
      editedCloudType: editCloudType,
      editedDate: editDate || undefined,
      editedTags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      reviewDecision: 'edit',
      selected: true,
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`bg-slate-800/90 border rounded-xl p-4 space-y-3 transition-all cursor-pointer ${cardBorder}`}
      onClick={() => !isEditing && onActivate()}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className="text-lg mt-0.5">{CLOUD_ICONS[cloudType] ?? '•'}</span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              className="w-full bg-slate-700 text-text-primary text-sm font-medium rounded px-2 py-1 border border-indigo-500/30 focus:outline-none focus:border-indigo-400"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-text-primary text-sm font-medium leading-snug truncate">{title}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs border rounded-full px-2 py-0.5 ${confidenceBadge}`}>
              {Math.round(confidence * 100)}%
            </span>
            <span className="text-xs text-text-secondary capitalize">
              {CLOUD_LABELS[cloudType] ?? cloudType}
            </span>
            {date && <span className="text-xs text-text-secondary">{date}</span>}
            {item.isDuplicate && !item.isTransformationCandidate && (
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                Possible duplicate
              </span>
            )}
            {item.isTransformationCandidate && (
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">
                Transformation?
              </span>
            )}
          </div>
        </div>

        {/* Collapse toggle for sensitive content */}
        {item.hasSensitiveContent && (
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 flex-shrink-0"
          >
            {collapsed ? 'Show' : 'Hide'} sensitive
          </button>
        )}
      </div>

      {/* Privacy / third-party consent warnings */}
      {(item.privacyFlags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(item.privacyFlags ?? []).map((flag) => (
            <span key={flag} className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/15 rounded px-1.5 py-0.5">
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        isEditing ? (
          <textarea
            className="w-full bg-slate-700 text-text-secondary text-xs rounded px-2 py-1.5 border border-indigo-500/30 focus:outline-none focus:border-indigo-400 resize-none"
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">{content}</p>
        )
      )}

      {/* Edit fields */}
      {isEditing && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-text-secondary text-xs block mb-1">Type</label>
              <select
                className="w-full bg-slate-700 text-text-primary text-xs rounded px-2 py-1.5 border border-indigo-500/30 focus:outline-none"
                value={editCloudType}
                onChange={(e) => setEditCloudType(e.target.value)}
              >
                {CLOUD_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{CLOUD_LABELS[ct]}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-text-secondary text-xs block mb-1">Date</label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-700 text-text-primary text-xs rounded px-2 py-1.5 border border-indigo-500/30 focus:outline-none"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-text-secondary text-xs block mb-1">Tags (comma-separated)</label>
            <input
              className="w-full bg-slate-700 text-text-primary text-xs rounded px-2 py-1.5 border border-indigo-500/30 focus:outline-none"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {!isEditing && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 rounded px-1.5 py-0.5">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex gap-2 pt-1 border-t border-slate-700" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-slate-700 hover:bg-slate-600 text-text-secondary text-xs rounded-lg px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onAccept}
                className={`flex-1 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  decision === 'accept'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400'
                }`}
              >
                Accept
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onReject}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  decision === 'reject'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400'
                }`}
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

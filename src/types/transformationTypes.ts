/**
 * Transformation type definitions with directional labels.
 *
 * Asymmetric: A→B has different meaning than B→A
 * Symmetric: A↔B reads the same from both sides
 */

export interface TransformationTypeDef {
  id: string;
  forwardLabel: string;   // shown on source item: "This memory [evolved into] ..."
  inverseLabel: string;   // shown on target item: "This belief [evolved from] ..."
  symmetric: boolean;
  icon: string;
  color: string;
}

export const TRANSFORMATION_TYPES: TransformationTypeDef[] = [
  {
    id: 'evolved_into',
    forwardLabel: 'evolved into',
    inverseLabel: 'evolved from',
    symmetric: false,
    icon: '🔄',
    color: 'text-purple-400',
  },
  {
    id: 'inspired',
    forwardLabel: 'inspired',
    inverseLabel: 'was inspired by',
    symmetric: false,
    icon: '💡',
    color: 'text-amber-400',
  },
  {
    id: 'contradicts',
    forwardLabel: 'contradicts',
    inverseLabel: 'contradicts',
    symmetric: true,
    icon: '⚡',
    color: 'text-red-400',
  },
  {
    id: 'supports',
    forwardLabel: 'supports',
    inverseLabel: 'is supported by',
    symmetric: true,
    icon: '🤝',
    color: 'text-emerald-400',
  },
  {
    id: 'replaced',
    forwardLabel: 'replaced',
    inverseLabel: 'was replaced by',
    symmetric: false,
    icon: '↩️',
    color: 'text-blue-400',
  },
];

export const TRANSFORMATION_TYPE_MAP = new Map(
  TRANSFORMATION_TYPES.map((t) => [t.id, t]),
);

export function getTransformationLabel(
  typeId: string,
  direction: 'forward' | 'inverse',
): string {
  const def = TRANSFORMATION_TYPE_MAP.get(typeId);
  if (!def) return typeId;
  return direction === 'forward' ? def.forwardLabel : def.inverseLabel;
}

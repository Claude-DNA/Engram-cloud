// State diff engine — Area 4.6
// Deterministic comparison of state_data objects to detect belief/value changes.

export type DiffType =
  | 'new'
  | 'removed'
  | 'intensified'
  | 'weakened'
  | 'changed'
  | 'reversed';

export interface StateDiff {
  field: string;
  type: DiffType;
  oldValue: unknown;
  newValue: unknown;
  magnitude: number; // 0-1 based on severity
}

export interface StateDiffResult {
  diffs: StateDiff[];
  /** Overall magnitude 0-1 */
  magnitude: number;
  /** Suggests this is a transformation, not just an update */
  isTransformation: boolean;
}

interface StateData {
  emotion?: string;
  emotionIntensity?: number;
  certainty?: number;
  commitment?: number;
  valence?: number;
  themes?: string[];
  [key: string]: unknown;
}

/** Compare two state_data objects and return a structured diff. */
export function diffStates(oldState: StateData | null, newState: StateData | null): StateDiffResult {
  const diffs: StateDiff[] = [];

  if (!oldState && !newState) return { diffs: [], magnitude: 0, isTransformation: false };
  if (!oldState) return { diffs: [], magnitude: 0, isTransformation: false };
  if (!newState) return { diffs: [], magnitude: 0, isTransformation: false };

  // Compare numeric fields
  const numericFields: Array<keyof StateData> = ['emotionIntensity', 'certainty', 'commitment'];
  for (const field of numericFields) {
    const oldVal = oldState[field] as number | undefined;
    const newVal = newState[field] as number | undefined;

    if (oldVal === undefined && newVal !== undefined) {
      diffs.push({ field, type: 'new', oldValue: null, newValue: newVal, magnitude: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      diffs.push({ field, type: 'removed', oldValue: oldVal, newValue: null, magnitude: oldVal });
    } else if (oldVal !== undefined && newVal !== undefined) {
      const delta = newVal - oldVal;
      if (Math.abs(delta) > 0.05) {
        const type: DiffType = delta > 0 ? 'intensified' : 'weakened';
        diffs.push({ field, type, oldValue: oldVal, newValue: newVal, magnitude: Math.min(1, Math.abs(delta)) });
      }
    }
  }

  // Compare valence (special: sign reversal = reversed)
  const oldValence = oldState.valence as number | undefined;
  const newValence = newState.valence as number | undefined;
  if (oldValence !== undefined && newValence !== undefined) {
    const delta = newValence - oldValence;
    if (Math.abs(delta) > 0.1) {
      const isReversed = Math.sign(oldValence) !== Math.sign(newValence) && Math.abs(oldValence) > 0.2;
      diffs.push({
        field: 'valence',
        type: isReversed ? 'reversed' : delta > 0 ? 'intensified' : 'weakened',
        oldValue: oldValence,
        newValue: newValence,
        magnitude: Math.min(1, Math.abs(delta) / 2),
      });
    }
  }

  // Compare emotion string
  if (oldState.emotion !== newState.emotion && oldState.emotion && newState.emotion) {
    diffs.push({
      field: 'emotion',
      type: 'changed',
      oldValue: oldState.emotion,
      newValue: newState.emotion,
      magnitude: 0.5,
    });
  }

  // Compare themes (set difference)
  const oldThemes = new Set(oldState.themes ?? []);
  const newThemes = new Set(newState.themes ?? []);
  const addedThemes = [...newThemes].filter((t) => !oldThemes.has(t));
  const removedThemes = [...oldThemes].filter((t) => !newThemes.has(t));

  if (addedThemes.length > 0) {
    diffs.push({
      field: 'themes',
      type: 'new',
      oldValue: oldState.themes,
      newValue: addedThemes,
      magnitude: Math.min(1, addedThemes.length * 0.2),
    });
  }
  if (removedThemes.length > 0) {
    diffs.push({
      field: 'themes',
      type: 'removed',
      oldValue: removedThemes,
      newValue: newState.themes,
      magnitude: Math.min(1, removedThemes.length * 0.2),
    });
  }

  const magnitude = diffs.length === 0
    ? 0
    : Math.min(1, diffs.reduce((sum, d) => sum + d.magnitude, 0) / diffs.length);

  // A result with high magnitude or a valence reversal suggests a real transformation
  const isTransformation = magnitude >= 0.5 || diffs.some((d) => d.type === 'reversed');

  return { diffs, magnitude, isTransformation };
}

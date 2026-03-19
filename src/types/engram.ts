export type CloudType =
  | 'memory'
  | 'knowledge'
  | 'belief'
  | 'value'
  | 'skill'
  | 'goal'
  | 'reflection';

export const VALID_CLOUD_TYPES: readonly CloudType[] = [
  'memory',
  'knowledge',
  'belief',
  'value',
  'skill',
  'goal',
  'reflection',
] as const;

export interface Person {
  id: number;
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LifePhase {
  id: number;
  uuid: string;
  person_id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface EngramItemBase {
  id: number;
  uuid: string;
  person_id: number;
  title: string;
  content: string;
  date: string | null;
  life_phase_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MemoryItem extends EngramItemBase { cloud_type: 'memory' }
export interface KnowledgeItem extends EngramItemBase { cloud_type: 'knowledge' }
export interface BeliefItem extends EngramItemBase { cloud_type: 'belief' }
export interface ValueItem extends EngramItemBase { cloud_type: 'value' }
export interface SkillItem extends EngramItemBase { cloud_type: 'skill' }
export interface GoalItem extends EngramItemBase { cloud_type: 'goal' }
export interface ReflectionItem extends EngramItemBase { cloud_type: 'reflection' }

export type EngramItem =
  | MemoryItem
  | KnowledgeItem
  | BeliefItem
  | ValueItem
  | SkillItem
  | GoalItem
  | ReflectionItem;

export interface Transformation {
  id: number;
  uuid: string;
  person_id: number;
  source_id: number;
  target_id: number;
  transformation_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngramItemExperience {
  id: number;
  uuid: string;
  engram_item_id: number;
  experience_type: string;
  content: string;
  date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  uuid: string;
  name: string;
  created_at: string;
}

export interface EngramItemTag {
  id: number;
  engram_item_id: number;
  tag_id: number;
}

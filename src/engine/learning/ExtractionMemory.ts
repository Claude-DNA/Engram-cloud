// Extraction memory — Area 4.5
// Stores user review decisions in DB and enables pattern-based learning.

import { db } from '../../lib/db';
import { generateUUIDv7 as generateId } from '../../lib/uuid';

export type ReviewDecision = 'accept' | 'reject' | 'edit';

export interface ReviewRecord {
  id: string;
  itemId: string;
  jobId: string;
  decision: ReviewDecision;
  originalCloudType?: string;
  acceptedCloudType?: string;
  originalTitle?: string;
  acceptedTitle?: string;
  originalContent?: string;
  acceptedContent?: string;
  originalTags?: string[];
  acceptedTags?: string[];
  createdAt: string;
}

export interface PatternSummary {
  pattern: string;
  count: number;
  description: string;
}

/** Persist a user's review decision for a single extracted item. */
export async function recordDecision(record: Omit<ReviewRecord, 'id' | 'createdAt'>): Promise<void> {
  const id = generateId();
  const createdAt = new Date().toISOString();

  await db.execute(
    `INSERT INTO _extraction_memory
      (id, item_id, job_id, decision, original_cloud_type, accepted_cloud_type,
       original_title, accepted_title, original_content, accepted_content,
       original_tags, accepted_tags, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      record.itemId,
      record.jobId,
      record.decision,
      record.originalCloudType ?? null,
      record.acceptedCloudType ?? null,
      record.originalTitle ?? null,
      record.acceptedTitle ?? null,
      record.originalContent ?? null,
      record.acceptedContent ?? null,
      record.originalTags ? JSON.stringify(record.originalTags) : null,
      record.acceptedTags ? JSON.stringify(record.acceptedTags) : null,
      createdAt,
    ],
  );
}

/** Load all records for analysis. */
export async function loadAllRecords(): Promise<ReviewRecord[]> {
  const rows = await db.query(
    `SELECT * FROM _extraction_memory ORDER BY created_at DESC`,
    [],
  );
  return rows.map(rowToRecord);
}

/** Load records for a specific job. */
export async function loadJobRecords(jobId: string): Promise<ReviewRecord[]> {
  const rows = await db.query(
    `SELECT * FROM _extraction_memory WHERE job_id = ? ORDER BY created_at DESC`,
    [jobId],
  );
  return rows.map(rowToRecord);
}

/** Count total decisions by type. */
export async function getDecisionStats(): Promise<Record<ReviewDecision, number>> {
  const rows = await db.query(
    `SELECT decision, COUNT(*) as count FROM _extraction_memory GROUP BY decision`,
    [],
  );
  const stats: Record<ReviewDecision, number> = { accept: 0, reject: 0, edit: 0 };
  for (const row of rows) {
    stats[row.decision as ReviewDecision] = Number(row.count);
  }
  return stats;
}

/** Delete all memory records (reset). */
export async function resetMemory(): Promise<void> {
  await db.execute(`DELETE FROM _extraction_memory`, []);
}

function rowToRecord(row: Record<string, unknown>): ReviewRecord {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    jobId: String(row.job_id),
    decision: row.decision as ReviewDecision,
    originalCloudType: row.original_cloud_type as string | undefined,
    acceptedCloudType: row.accepted_cloud_type as string | undefined,
    originalTitle: row.original_title as string | undefined,
    acceptedTitle: row.accepted_title as string | undefined,
    originalContent: row.original_content as string | undefined,
    acceptedContent: row.accepted_content as string | undefined,
    originalTags: row.original_tags ? JSON.parse(row.original_tags as string) : undefined,
    acceptedTags: row.accepted_tags ? JSON.parse(row.accepted_tags as string) : undefined,
    createdAt: String(row.created_at),
  };
}

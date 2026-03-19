-- Area 4.5: Extraction memory table for learning from user review decisions
CREATE TABLE IF NOT EXISTS _extraction_memory (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accept', 'reject', 'edit')),
  original_cloud_type TEXT,
  accepted_cloud_type TEXT,
  original_title TEXT,
  accepted_title TEXT,
  original_content TEXT,
  accepted_content TEXT,
  original_tags TEXT,
  accepted_tags TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_extraction_memory_job ON _extraction_memory(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_memory_decision ON _extraction_memory(decision);

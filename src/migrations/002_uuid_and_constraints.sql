ALTER TABLE persons ADD COLUMN uuid TEXT;
ALTER TABLE life_phases ADD COLUMN uuid TEXT;
ALTER TABLE engram_items ADD COLUMN uuid TEXT;
ALTER TABLE transformations ADD COLUMN uuid TEXT;
ALTER TABLE engram_item_experiences ADD COLUMN uuid TEXT;
ALTER TABLE tags ADD COLUMN uuid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_uuid ON persons(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_life_phases_uuid ON life_phases(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engram_items_uuid ON engram_items(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transformations_uuid ON transformations(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_experiences_uuid ON engram_item_experiences(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_uuid ON tags(uuid);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transformations_unique_link ON transformations(source_id, target_id, transformation_type);

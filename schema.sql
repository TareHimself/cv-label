-- Represents image metadata
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL
);

-- Represents labeled samples referencing an image
CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Represents annotations, each belonging to a sample
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  type INTEGER NOT NULL,    -- Assuming ELabelType is an enum
  class INTEGER NOT NULL,
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);

-- Represents individual points
CREATE TABLE IF NOT EXISTS points (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  idx INTEGER NOT NULL,
  FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
);


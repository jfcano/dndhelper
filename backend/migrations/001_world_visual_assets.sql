-- Añade metadatos e imágenes generadas por IA asociadas al mundo.
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS visual_assets jsonb;

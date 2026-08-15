-- Custom SQL migration file, put your code below! --
-- Renames the polygon annotation type's stored value from 'mask' to 'polygon', matching
-- the AnnotationType enum rename in src/shared/types.ts. Box annotations are untouched.
UPDATE `annotations` SET `type` = 'polygon' WHERE `type` = 'mask';
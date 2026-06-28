-- ============================================================
-- Migration: Add city column to ngos table
-- Run this in MySQL Workbench (Ctrl+Shift+Enter) AFTER schema.sql
-- Safe to run multiple times.
-- ============================================================

USE foodlink_db;

-- Add city column if it doesn't already exist
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'foodlink_db' AND TABLE_NAME = 'ngos' AND COLUMN_NAME = 'city'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE ngos ADD COLUMN city VARCHAR(100) DEFAULT "Unknown" AFTER name',
  'SELECT "city column already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill city for the demo NGOs seeded earlier (all are in Vijayawada)
UPDATE ngos SET city = 'Vijayawada' WHERE name IN (
  'Hope Center Shelter', 'City Food Bank', 'Downtown Mission',
  'Sunrise NGO Kitchen', 'Green Earth Foundation'
) AND (city IS NULL OR city = 'Unknown');

SELECT id, name, city, latitude, longitude FROM ngos;
-- ============================================================
-- Resume cleanup: finish repointing + deleting duplicates
-- Run this in the SAME query tab/session where ngo_keep_map
-- was just created (it's a TEMPORARY TABLE, only visible in
-- that session). If you get "Unknown table ngo_keep_map",
-- re-run cleanup_duplicate_ngos.sql from the top instead.
-- ============================================================

SET SQL_SAFE_UPDATES = 0;

-- Step 2: Repoint any donations pointing to a duplicate NGO over to the keeper
UPDATE donations d
JOIN ngo_keep_map m ON d.ngo_id = m.duplicate_id
SET d.ngo_id = m.keeper_id;

-- Step 3: Delete the duplicate NGO rows
DELETE n FROM ngos n
JOIN ngo_keep_map m ON n.id = m.duplicate_id;

SET SQL_SAFE_UPDATES = 1;

DROP TEMPORARY TABLE IF EXISTS ngo_keep_map;

-- Step 4: Verify - should now show exactly 5 NGOs, no duplicates
SELECT id, name, city, latitude, longitude, capacity, accepted_types, approved
FROM ngos
ORDER BY id;
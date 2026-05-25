-- 1. Create Tree table.
CREATE TABLE "Tree" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tree_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Tree_ownerId_idx" ON "Tree"("ownerId");
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Add Person.treeId as nullable (no FK yet — we backfill before tightening).
ALTER TABLE "Person" ADD COLUMN "treeId" TEXT;

-- 3a. Normalise roles. Old: 'admin'|'viewer'. New: 'superadmin'|'user'.
UPDATE "User" SET role = 'superadmin' WHERE role = 'admin';
UPDATE "User" SET role = 'user'       WHERE role = 'viewer';
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'user';

-- 3b. Create a Tree for the existing 108-person data and assign it to the
--     oldest super-admin. Abort the migration loudly if none exists.
DO $$
DECLARE
  v_owner TEXT;
  v_tree  TEXT;
BEGIN
  SELECT id INTO v_owner
  FROM "User"
  WHERE role = 'superadmin'
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF (SELECT COUNT(*) FROM "Person") > 0 THEN
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'No superadmin user exists. Run `pnpm create-superadmin <email> <password>` before migrating.';
    END IF;
  END IF;

  IF (SELECT COUNT(*) FROM "Person") > 0 THEN
    v_tree := gen_random_uuid()::text;
    INSERT INTO "Tree" (id, name, "ownerId", "createdAt", "updatedAt")
      VALUES (v_tree, 'Armenian Family Tree', v_owner, NOW(), NOW());
    UPDATE "Person" SET "treeId" = v_tree;
  END IF;
END $$;

-- 4. Tighten Person constraints.
ALTER TABLE "Person" ALTER COLUMN "treeId" SET NOT NULL;
ALTER TABLE "Person" ADD CONSTRAINT "Person_treeId_fkey"
  FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Person_treeId_idx" ON "Person"("treeId");

-- Fallback path: add parentTreeId column and populate it before PK swap.
ALTER TABLE "Person" ADD COLUMN "parentTreeId" TEXT;
UPDATE "Person" SET "parentTreeId" = "treeId" WHERE "parentId" IS NOT NULL;

-- Drop the old self-referential FK (depends on Person_pkey) before swapping PK.
ALTER TABLE "Person" DROP CONSTRAINT IF EXISTS "Person_parentId_fkey";

-- Swap primary key from (id) to (treeId, id).
ALTER TABLE "Person" DROP CONSTRAINT "Person_pkey";
ALTER TABLE "Person" ADD CONSTRAINT "Person_pkey" PRIMARY KEY ("treeId", "id");

-- Add new composite self-referential FK using the new composite PK.
ALTER TABLE "Person" ADD CONSTRAINT "Person_parent_fkey"
  FOREIGN KEY ("parentTreeId", "parentId") REFERENCES "Person"("treeId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

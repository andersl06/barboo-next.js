ALTER TABLE "BarbershopMembership"
ADD COLUMN "canManageBlocks" BOOLEAN NOT NULL DEFAULT false;

UPDATE "BarbershopMembership" AS m
SET "canManageBlocks" = true
FROM "BarberProfile" AS p
WHERE m."userId" = p."userId"
  AND m."role" = 'BARBER'
  AND p."canManageBlocks" = true;

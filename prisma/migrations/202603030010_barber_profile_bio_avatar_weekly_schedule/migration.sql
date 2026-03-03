-- AlterTable
ALTER TABLE "BarberProfile"
  ALTER COLUMN "bio" TYPE VARCHAR(500),
  ALTER COLUMN "avatarUrl" TYPE TEXT,
  ADD COLUMN "weeklySchedule" JSONB;

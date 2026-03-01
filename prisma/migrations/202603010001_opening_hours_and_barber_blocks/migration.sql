-- Add canManageBlocks on BarberProfile
ALTER TABLE "BarberProfile"
ADD COLUMN "canManageBlocks" BOOLEAN NOT NULL DEFAULT false;

-- Create BarberBlock table
CREATE TABLE "BarberBlock" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "barberUserId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" VARCHAR(5),
  "endTime" VARCHAR(5),
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "reason" VARCHAR(200),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarberBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BarberBlock_barbershopId_barberUserId_date_idx"
ON "BarberBlock"("barbershopId", "barberUserId", "date");

ALTER TABLE "BarberBlock"
ADD CONSTRAINT "BarberBlock_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BarberBlock"
ADD CONSTRAINT "BarberBlock_barberUserId_fkey"
FOREIGN KEY ("barberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BarberBlock"
ADD CONSTRAINT "BarberBlock_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

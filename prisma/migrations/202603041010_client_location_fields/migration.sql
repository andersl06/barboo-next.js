ALTER TABLE "User"
ADD COLUMN "clientLatitude" DECIMAL(10,7),
ADD COLUMN "clientLongitude" DECIMAL(10,7),
ADD COLUMN "clientLocationUpdatedAt" TIMESTAMP(3);

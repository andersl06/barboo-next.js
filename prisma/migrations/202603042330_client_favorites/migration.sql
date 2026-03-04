CREATE TABLE "favorite_barbershops" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "favorite_barbershops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorite_barbershops_userId_barbershopId_key"
ON "favorite_barbershops"("userId", "barbershopId");

CREATE INDEX "favorite_barbershops_userId_createdAt_idx"
ON "favorite_barbershops"("userId", "createdAt");

CREATE INDEX "favorite_barbershops_barbershopId_createdAt_idx"
ON "favorite_barbershops"("barbershopId", "createdAt");

ALTER TABLE "favorite_barbershops"
ADD CONSTRAINT "favorite_barbershops_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorite_barbershops"
ADD CONSTRAINT "favorite_barbershops_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

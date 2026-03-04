-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."barbershop_appointments" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "barberUserId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "cancelReason" VARCHAR(300),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barbershop_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barbershop_appointments_barbershopId_startAt_idx"
ON "public"."barbershop_appointments"("barbershopId", "startAt");

-- CreateIndex
CREATE INDEX "barbershop_appointments_barberUserId_startAt_idx"
ON "public"."barbershop_appointments"("barberUserId", "startAt");

-- CreateIndex
CREATE INDEX "barbershop_appointments_clientUserId_startAt_idx"
ON "public"."barbershop_appointments"("clientUserId", "startAt");

-- CreateIndex
CREATE INDEX "barbershop_appointments_status_startAt_idx"
ON "public"."barbershop_appointments"("status", "startAt");

-- AddForeignKey
ALTER TABLE "public"."barbershop_appointments"
ADD CONSTRAINT "barbershop_appointments_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "public"."barbershops"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_appointments"
ADD CONSTRAINT "barbershop_appointments_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "public"."barbershop_services"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_appointments"
ADD CONSTRAINT "barbershop_appointments_clientUserId_fkey"
FOREIGN KEY ("clientUserId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_appointments"
ADD CONSTRAINT "barbershop_appointments_barberUserId_fkey"
FOREIGN KEY ("barberUserId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_appointments"
ADD CONSTRAINT "barbershop_appointments_canceledByUserId_fkey"
FOREIGN KEY ("canceledByUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

DO $$ BEGIN
  CREATE TYPE "FinancialStatus" AS ENUM ('ACTIVE', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinanceInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "barbershops"
  ADD COLUMN IF NOT EXISTS "financialStatus" "FinancialStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "blockedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);

ALTER TABLE "barbershop_appointments"
  ADD COLUMN IF NOT EXISTS "servicePriceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "serviceFeeCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalPriceCents" INTEGER;

UPDATE "barbershop_appointments" AS a
SET
  "servicePriceCents" = s."priceCents",
  "serviceFeeCents" = GREATEST(ROUND((s."priceCents"::numeric) * 0.03)::integer, 100),
  "totalPriceCents" = s."priceCents" + GREATEST(ROUND((s."priceCents"::numeric) * 0.03)::integer, 100)
FROM "barbershop_services" AS s
WHERE a."serviceId" = s."id"
  AND (
    a."servicePriceCents" IS NULL
    OR a."serviceFeeCents" IS NULL
    OR a."totalPriceCents" IS NULL
  );

ALTER TABLE "barbershop_appointments"
  ALTER COLUMN "servicePriceCents" SET NOT NULL,
  ALTER COLUMN "serviceFeeCents" SET NOT NULL,
  ALTER COLUMN "totalPriceCents" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "weekly_invoices" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "FinanceInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "totalAppointments" INTEGER NOT NULL DEFAULT 0,
  "totalFeesCents" INTEGER NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "weekly_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "weekly_invoice_appointments" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "weekly_invoice_appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_invoices_barbershopId_periodStart_periodEnd_key"
ON "weekly_invoices"("barbershopId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "weekly_invoices_barbershopId_status_dueAt_idx"
ON "weekly_invoices"("barbershopId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "weekly_invoices_barbershopId_periodStart_periodEnd_idx"
ON "weekly_invoices"("barbershopId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_invoice_appointments_appointmentId_key"
ON "weekly_invoice_appointments"("appointmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_invoice_appointments_invoiceId_appointmentId_key"
ON "weekly_invoice_appointments"("invoiceId", "appointmentId");

CREATE INDEX IF NOT EXISTS "weekly_invoice_appointments_appointmentId_idx"
ON "weekly_invoice_appointments"("appointmentId");

DO $$ BEGIN
  ALTER TABLE "weekly_invoices"
  ADD CONSTRAINT "weekly_invoices_barbershopId_fkey"
  FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "weekly_invoice_appointments"
  ADD CONSTRAINT "weekly_invoice_appointments_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "weekly_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "weekly_invoice_appointments"
  ADD CONSTRAINT "weekly_invoice_appointments_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "barbershop_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

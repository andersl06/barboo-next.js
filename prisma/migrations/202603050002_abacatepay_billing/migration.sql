ALTER TABLE "weekly_invoices"
  ADD COLUMN IF NOT EXISTS "abacateChargeId" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "abacateChargeStatus" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "abacateChargeCreatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "abacateChargeExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "abacateQrCodeImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "abacateQrCodeCopyPaste" TEXT,
  ADD COLUMN IF NOT EXISTS "abacatePaidAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "abacatePaidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_invoices_abacateChargeId_key"
ON "weekly_invoices"("abacateChargeId");

-- Update weekly_invoices payment fields from AbacatePay to Mercado Pago
ALTER TABLE "weekly_invoices"
  DROP COLUMN IF EXISTS "abacateChargeId",
  DROP COLUMN IF EXISTS "abacateChargeStatus",
  DROP COLUMN IF EXISTS "abacateChargeCreatedAt",
  DROP COLUMN IF EXISTS "abacateChargeExpiresAt",
  DROP COLUMN IF EXISTS "abacateQrCodeImageUrl",
  DROP COLUMN IF EXISTS "abacateQrCodeCopyPaste",
  DROP COLUMN IF EXISTS "abacatePaidAmountCents",
  DROP COLUMN IF EXISTS "abacatePaidAt",
  ADD COLUMN IF NOT EXISTS "paymentProvider" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "providerPaymentId" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "providerStatus" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "providerStatusDetail" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "providerAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "providerExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "providerPixCode" TEXT,
  ADD COLUMN IF NOT EXISTS "providerQrCodeBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "providerTicketUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "providerExternalReference" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "providerIdempotencyKey" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "providerPaidAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "weekly_invoices_abacateChargeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_invoices_paymentProvider_providerPaymentId_key"
ON "weekly_invoices"("paymentProvider", "providerPaymentId");

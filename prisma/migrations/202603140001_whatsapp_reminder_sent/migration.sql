ALTER TABLE "barbershop_appointments"
ADD COLUMN IF NOT EXISTS "whatsappReminderSentAt" TIMESTAMP;

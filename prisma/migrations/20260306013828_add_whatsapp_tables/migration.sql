-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "waId" VARCHAR(32) NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_inbound_messages" (
    "id" TEXT NOT NULL,
    "waId" VARCHAR(32) NOT NULL,
    "messageId" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40),
    "bodyPreview" VARCHAR(200),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_waId_key" ON "whatsapp_contacts"("waId");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_lastInboundAt_idx" ON "whatsapp_contacts"("lastInboundAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_inbound_messages_messageId_key" ON "whatsapp_inbound_messages"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_waId_receivedAt_idx" ON "whatsapp_inbound_messages"("waId", "receivedAt");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_receivedAt_idx" ON "whatsapp_inbound_messages"("receivedAt");

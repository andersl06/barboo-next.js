-- CreateTable
CREATE TABLE "public"."barbershop_categories" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershop_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."barbershop_services" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "priceCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avgRating" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershop_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barbershop_categories_barbershopId_name_key" ON "public"."barbershop_categories"("barbershopId", "name");

-- CreateIndex
CREATE INDEX "barbershop_categories_barbershopId_isActive_idx" ON "public"."barbershop_categories"("barbershopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "barbershop_services_barbershopId_name_key" ON "public"."barbershop_services"("barbershopId", "name");

-- CreateIndex
CREATE INDEX "barbershop_services_barbershopId_categoryId_isActive_idx" ON "public"."barbershop_services"("barbershopId", "categoryId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."barbershop_categories" ADD CONSTRAINT "barbershop_categories_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_services" ADD CONSTRAINT "barbershop_services_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."barbershop_services" ADD CONSTRAINT "barbershop_services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."barbershop_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

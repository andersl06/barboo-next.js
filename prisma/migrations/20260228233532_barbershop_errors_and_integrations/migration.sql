-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'BARBER');

-- CreateEnum
CREATE TYPE "BarbershopStatus" AS ENUM ('EM_CONFIGURACAO', 'ATIVA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barbershops" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "phone" VARCHAR(20),
    "address" VARCHAR(220),
    "addressNumber" VARCHAR(20),
    "addressComplement" VARCHAR(120),
    "neighborhood" VARCHAR(150),
    "city" VARCHAR(120),
    "state" VARCHAR(5),
    "zipCode" VARCHAR(12),
    "slug" VARCHAR(200),
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "status" "BarbershopStatus" NOT NULL DEFAULT 'EM_CONFIGURACAO',
    "suspensionReason" TEXT,
    "suspensionUntil" DATE,
    "cnpj" VARCHAR(20),
    "cpf" VARCHAR(20),
    "avgPrice" DECIMAL(10,2),
    "avgTimeMinutes" INTEGER,
    "facilities" TEXT[],
    "paymentMethods" TEXT[],
    "openingHours" JSONB,
    "socialLinks" JSONB,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarbershopMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarbershopMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "BarberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "barbershops_slug_key" ON "barbershops"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "barbershops_cnpj_key" ON "barbershops"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "barbershops_cpf_key" ON "barbershops"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "BarbershopMembership_userId_barbershopId_key" ON "BarbershopMembership"("userId", "barbershopId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberProfile_userId_key" ON "BarberProfile"("userId");

-- AddForeignKey
ALTER TABLE "BarbershopMembership" ADD CONSTRAINT "BarbershopMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarbershopMembership" ADD CONSTRAINT "BarbershopMembership_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberProfile" ADD CONSTRAINT "BarberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

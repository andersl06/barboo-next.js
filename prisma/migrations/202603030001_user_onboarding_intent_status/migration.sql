-- CreateEnum
CREATE TYPE "public"."OnboardingIntent" AS ENUM ('CLIENT', 'OWNER');

-- CreateEnum
CREATE TYPE "public"."OnboardingStatus" AS ENUM ('PENDING', 'DONE');

-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "onboardingIntent" "public"."OnboardingIntent" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN "onboardingStatus" "public"."OnboardingStatus" NOT NULL DEFAULT 'DONE';

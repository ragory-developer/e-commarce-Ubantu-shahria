/*
  Warnings:

  - You are about to drop the column `device_info` on the `auth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `auth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `userType` on the `auth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `user_agent` on the `auth_tokens` table. All the data in the column will be lost.
  - Added the required column `token_family` to the `auth_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_type` to the `auth_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'REGISTER_ACCOUNT';

-- DropIndex
DROP INDEX "auth_tokens_userType_idx";

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "auth_tokens" DROP COLUMN "device_info",
DROP COLUMN "ip_address",
DROP COLUMN "userType",
DROP COLUMN "user_agent",
ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "token_family" VARCHAR(191) NOT NULL,
ADD COLUMN     "user_type" "AuthUserType" NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT,
    "customer_id" TEXT,
    "user_type" "AuthUserType" NOT NULL,
    "device_id" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_admin_id_device_id_key" ON "devices"("admin_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_customer_id_device_id_key" ON "devices"("customer_id", "device_id");

-- CreateIndex
CREATE INDEX "auth_tokens_token_family_idx" ON "auth_tokens"("token_family");

-- CreateIndex
CREATE INDEX "auth_tokens_user_type_idx" ON "auth_tokens"("user_type");

-- CreateIndex
CREATE INDEX "auth_tokens_device_id_idx" ON "auth_tokens"("device_id");

-- CreateIndex
CREATE INDEX "verification_otps_verified_idx" ON "verification_otps"("verified");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

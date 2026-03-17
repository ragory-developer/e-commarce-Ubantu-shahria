-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "device_name" VARCHAR(191),
ADD COLUMN     "device_type" VARCHAR(50),
ADD COLUMN     "ip_address" VARCHAR(45),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "devices_is_active_idx" ON "devices"("is_active");

-- CreateIndex
CREATE INDEX "devices_revoked_at_idx" ON "devices"("revoked_at");

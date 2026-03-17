/*
  Warnings:

  - The values [RESERVED] on the enum `InventoryReason` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `user_id` on the `stock_reservations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- AlterEnum
BEGIN;
CREATE TYPE "InventoryReason_new" AS ENUM ('INITIAL_STOCK', 'ORDER_PLACED', 'ORDER_RESERVED', 'ORDER_CANCELED', 'ORDER_ITEM_CANCELED', 'ORDER_REFUNDED', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'DAMAGED', 'RETURNED', 'RESERVATION_RELEASED', 'RESERVATION_CONVERTED');
ALTER TABLE "inventory_logs" ALTER COLUMN "reason" TYPE "InventoryReason_new" USING ("reason"::text::"InventoryReason_new");
ALTER TYPE "InventoryReason" RENAME TO "InventoryReason_old";
ALTER TYPE "InventoryReason_new" RENAME TO "InventoryReason";
DROP TYPE "public"."InventoryReason_old";
COMMIT;

-- DropIndex
DROP INDEX "stock_reservations_user_id_idx";

-- AlterTable
ALTER TABLE "inventory_logs" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "order_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "coupon_discount_type" "CouponDiscountType",
ADD COLUMN     "coupon_discount_value" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "stock_reservations" DROP COLUMN "user_id",
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "order_id" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "failed_at" TIMESTAMP(3),
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED';

-- CreateIndex
CREATE INDEX "inventory_logs_order_id_idx" ON "inventory_logs"("order_id");

-- CreateIndex
CREATE INDEX "inventory_logs_created_by_idx" ON "inventory_logs"("created_by");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

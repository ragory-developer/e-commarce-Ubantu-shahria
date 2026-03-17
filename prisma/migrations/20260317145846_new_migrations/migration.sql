/*
  Warnings:

  - The values [MANAGE_USERS,VIEW_USERS,MANAGE_PRODUCTS,VIEW_PRODUCTS,MANAGE_ORDERS,VIEW_ORDERS,MANAGE_PAYMENTS,VIEW_PAYMENTS,VIEW_REPORTS,EXPORT_DATA,MANAGE_SETTINGS,MANAGE_COUPONS,MANAGE_SHIPPING,MANAGE_DELIVERY] on the enum `AdminPermission` will be removed. If these variants are still used in the database, this will fail.
  - The values [ORDER_ITEM_CANCELED] on the enum `InventoryReason` will be removed. If these variants are still used in the database, this will fail.
  - The values [COMPLETED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `address` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `descriptions` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `road` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `zip` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `attribute_values` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `attributes` table. All the data in the column will be lost.
  - The primary key for the `coupon_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `end_date` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `maximum_spend` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `minimum_spend` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `usage_limit_per_coupon` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `usage_limit_per_customer` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `end_date` on the `flash_sale_products` table. All the data in the column will be lost.
  - You are about to drop the column `campaign_name` on the `flash_sales` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `inventory_logs` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `inventory_logs` table. All the data in the column will be lost.
  - You are about to drop the column `stock_after` on the `inventory_logs` table. All the data in the column will be lost.
  - You are about to drop the column `stock_before` on the `inventory_logs` table. All the data in the column will be lost.
  - You are about to drop the column `mime_Type` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `notifications` table. All the data in the column will be lost.
  - The primary key for the `order_taxes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `paid_at` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shipping_method` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `tracking_reference` on the `orders` table. All the data in the column will be lost.
  - You are about to alter the column `coupon_code` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to drop the column `created_at` on the `price_history` table. All the data in the column will be lost.
  - The primary key for the `product_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assigned_at` on the `product_categories` table. All the data in the column will be lost.
  - The primary key for the `product_tags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assigned_at` on the `product_tags` table. All the data in the column will be lost.
  - You are about to drop the column `dimensions` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `search_terms` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_by` on the `search_terms` table. All the data in the column will be lost.
  - You are about to drop the column `hits` on the `search_terms` table. All the data in the column will be lost.
  - You are about to drop the column `results` on the `search_terms` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `search_terms` table. All the data in the column will be lost.
  - You are about to drop the column `refunds` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `variations` table. All the data in the column will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `option_values` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_product_option_values` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_product_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_product_variation_values` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_product_variations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipping_rates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipping_zones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wish_lists` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[token_hash]` on the table `auth_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[flash_sale_id,product_id,product_variant_id]` on the table `flash_sale_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[product_id,attribute_id]` on the table `product_attributes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[product_id,category_id]` on the table `product_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[product_id,tag_id]` on the table `product_tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address_line` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postal_code` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `admins` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `owner_id` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_type` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount_value` to the `coupons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valid_from` to the `coupons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valid_to` to the `coupons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discountType` to the `flash_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount_value` to the `flash_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_time` to the `flash_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `flash_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `flash_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_after` to the `inventory_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_before` to the `inventory_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_change` to the `inventory_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime_type` to the `media` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `order_taxes` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `customer_phone` on table `orders` required. This step will fail if there are existing NULL values in that column.
  - The required column `id` was added to the `product_categories` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `product_tags` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `last_used_at` to the `search_terms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payment_status` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'INSPECTED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('WRONG_ITEM', 'DEFECTIVE_PRODUCT', 'ITEM_NOT_AS_DESCRIBED', 'CHANGED_MIND', 'DUPLICATE_ORDER', 'ARRIVED_DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FlashSaleStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShippingRuleType" AS ENUM ('FLAT', 'WEIGHT_BASED', 'PRICE_BASED', 'ITEM_BASED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT_CASHBACK', 'CREDIT_REFUND', 'CREDIT_ADJUSTMENT', 'CREDIT_REFERRAL', 'DEBIT_ORDER', 'DEBIT_ADJUSTMENT', 'DEBIT_EXPIRED');

-- CreateEnum
CREATE TYPE "CustomerTagColor" AS ENUM ('RED', 'AMBER', 'GREEN', 'BLUE', 'GRAY');

-- AlterEnum
BEGIN;
CREATE TYPE "AdminPermission_new" AS ENUM ('PRODUCT_CREATE', 'PRODUCT_READ', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_BULK_EDIT', 'ORDER_READ', 'ORDER_UPDATE_STATUS', 'ORDER_CANCEL', 'ORDER_REFUND', 'INVENTORY_MANAGE', 'INVENTORY_VIEW', 'FINANCE_VIEW', 'TRANSACTION_VIEW', 'COUPON_MANAGE', 'ADMIN_CREATE', 'ADMIN_EDIT', 'ADMIN_DELETE', 'ADMIN_PERMISSIONS', 'SETTINGS_MANAGE', 'LOGS_VIEW', 'RETURN_MANAGE');
ALTER TABLE "public"."admins" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "admins" ALTER COLUMN "permissions" TYPE "AdminPermission_new"[] USING ("permissions"::text::"AdminPermission_new"[]);
ALTER TYPE "AdminPermission" RENAME TO "AdminPermission_old";
ALTER TYPE "AdminPermission_new" RENAME TO "AdminPermission";
DROP TYPE "public"."AdminPermission_old";
ALTER TABLE "admins" ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::"AdminPermission"[];
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "InventoryReason_new" AS ENUM ('INITIAL_STOCK', 'ORDER_PLACED', 'ORDER_RESERVED', 'ORDER_CANCELED', 'ORDER_REFUNDED', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'DAMAGED', 'RETURNED', 'RESERVATION_RELEASED', 'RESERVATION_CONVERTED');
ALTER TABLE "inventory_logs" ALTER COLUMN "reason" TYPE "InventoryReason_new" USING ("reason"::text::"InventoryReason_new");
ALTER TYPE "InventoryReason" RENAME TO "InventoryReason_old";
ALTER TYPE "InventoryReason_new" RENAME TO "InventoryReason";
DROP TYPE "public"."InventoryReason_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'ON_HOLD', 'DECLINED');
ALTER TABLE "public"."orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "order_status_history" ALTER COLUMN "from_status" TYPE "OrderStatus_new" USING ("from_status"::text::"OrderStatus_new");
ALTER TABLE "order_status_history" ALTER COLUMN "to_status" TYPE "OrderStatus_new" USING ("to_status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "carts" DROP CONSTRAINT "carts_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "option_values" DROP CONSTRAINT "option_values_option_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_option_values" DROP CONSTRAINT "order_product_option_values_option_value_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_option_values" DROP CONSTRAINT "order_product_option_values_order_product_option_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_options" DROP CONSTRAINT "order_product_options_order_product_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_variation_values" DROP CONSTRAINT "order_product_variation_values_order_product_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_variation_values" DROP CONSTRAINT "order_product_variation_values_variation_value_id_fkey";

-- DropForeignKey
ALTER TABLE "order_product_variations" DROP CONSTRAINT "order_product_variations_order_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_options" DROP CONSTRAINT "product_options_option_id_fkey";

-- DropForeignKey
ALTER TABLE "product_options" DROP CONSTRAINT "product_options_product_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_rates" DROP CONSTRAINT "shipping_rates_shipping_zone_id_fkey";

-- DropForeignKey
ALTER TABLE "wish_lists" DROP CONSTRAINT "wish_lists_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "wish_lists" DROP CONSTRAINT "wish_lists_product_id_fkey";

-- DropIndex
DROP INDEX "addresses_country_idx";

-- DropIndex
DROP INDEX "addresses_created_at_idx";

-- DropIndex
DROP INDEX "api_keys_user_id_idx";

-- DropIndex
DROP INDEX "attribute_values_created_at_idx";

-- DropIndex
DROP INDEX "attributes_created_at_idx";

-- DropIndex
DROP INDEX "auth_tokens_user_type_idx";

-- DropIndex
DROP INDEX "brands_created_at_idx";

-- DropIndex
DROP INDEX "categories_created_at_idx";

-- DropIndex
DROP INDEX "coupons_is_active_start_date_end_date_idx";

-- DropIndex
DROP INDEX "devices_revoked_at_idx";

-- DropIndex
DROP INDEX "flash_sale_products_created_at_idx";

-- DropIndex
DROP INDEX "flash_sale_products_end_date_idx";

-- DropIndex
DROP INDEX "flash_sale_products_flash_sale_id_product_id_key";

-- DropIndex
DROP INDEX "flash_sales_created_at_idx";

-- DropIndex
DROP INDEX "inventory_logs_created_by_idx";

-- DropIndex
DROP INDEX "media_mime_Type_idx";

-- DropIndex
DROP INDEX "notifications_user_id_idx";

-- DropIndex
DROP INDEX "orders_paid_at_idx";

-- DropIndex
DROP INDEX "price_history_created_at_idx";

-- DropIndex
DROP INDEX "product_attributes_product_id_attribute_id_idx";

-- DropIndex
DROP INDEX "search_terms_deleted_at_idx";

-- DropIndex
DROP INDEX "search_terms_hits_idx";

-- DropIndex
DROP INDEX "tags_created_at_idx";

-- DropIndex
DROP INDEX "transactions_status_idx";

-- DropIndex
DROP INDEX "variation_values_created_at_idx";

-- DropIndex
DROP INDEX "variations_created_at_idx";

-- AlterTable
ALTER TABLE "addresses" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "created_by",
DROP COLUMN "descriptions",
DROP COLUMN "road",
DROP COLUMN "state",
DROP COLUMN "updated_by",
DROP COLUMN "zip",
ADD COLUMN     "address_line" TEXT NOT NULL,
ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "city_id" TEXT,
ADD COLUMN     "division_id" TEXT,
ADD COLUMN     "full_name" VARCHAR(191) NOT NULL,
ADD COLUMN     "phone" VARCHAR(50) NOT NULL,
ADD COLUMN     "postal_code" VARCHAR(10) NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'BD';

-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "user_id",
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "owner_type" VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE "attribute_values" DROP COLUMN "position",
ADD COLUMN     "hex_color" VARCHAR(7),
ADD COLUMN     "label" VARCHAR(191);

-- AlterTable
ALTER TABLE "attributes" DROP COLUMN "position";

-- AlterTable
ALTER TABLE "auth_tokens" ADD COLUMN     "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "banner_image" VARCHAR(500),
ADD COLUMN     "meta_description" VARCHAR(500),
ADD COLUMN     "meta_title" VARCHAR(255),
ALTER COLUMN "image" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "coupon_categories" DROP CONSTRAINT "coupon_categories_pkey",
ADD CONSTRAINT "coupon_categories_pkey" PRIMARY KEY ("coupon_id", "category_id");

-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "end_date",
DROP COLUMN "maximum_spend",
DROP COLUMN "minimum_spend",
DROP COLUMN "start_date",
DROP COLUMN "usage_limit_per_coupon",
DROP COLUMN "usage_limit_per_customer",
DROP COLUMN "value",
ADD COLUMN     "applicable_to_all" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "discount_value" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "max_order_value" DECIMAL(12,2),
ADD COLUMN     "min_order_value" DECIMAL(12,2),
ADD COLUMN     "usage_limit" INTEGER,
ADD COLUMN     "user_usage_limit" INTEGER,
ADD COLUMN     "valid_from" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "valid_to" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "flash_sale_products" DROP COLUMN "end_date",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "product_variant_id" TEXT,
ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "flash_sales" DROP COLUMN "campaign_name",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discountType" VARCHAR(10) NOT NULL,
ADD COLUMN     "discount_value" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "end_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" VARCHAR(191) NOT NULL,
ADD COLUMN     "start_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "FlashSaleStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "inventory_logs" DROP COLUMN "created_by",
DROP COLUMN "quantity",
DROP COLUMN "stock_after",
DROP COLUMN "stock_before",
ADD COLUMN     "changed_by" TEXT,
ADD COLUMN     "flash_sale_product_id" TEXT,
ADD COLUMN     "notes" VARCHAR(500),
ADD COLUMN     "qty_after" INTEGER NOT NULL,
ADD COLUMN     "qty_before" INTEGER NOT NULL,
ADD COLUMN     "qty_change" INTEGER NOT NULL,
ADD COLUMN     "reference" VARCHAR(100),
ALTER COLUMN "reason" SET DEFAULT 'MANUAL_ADJUSTMENT';

-- AlterTable
ALTER TABLE "media" DROP COLUMN "mime_Type",
ADD COLUMN     "mime_type" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "user_id",
ADD COLUMN     "recipient_id" TEXT,
ADD COLUMN     "recipient_type" VARCHAR(20);

-- AlterTable
ALTER TABLE "order_packages" ADD COLUMN     "courier_id" TEXT;

-- AlterTable
ALTER TABLE "order_products" ADD COLUMN     "variations_snapshot" JSONB;

-- AlterTable
ALTER TABLE "order_status_history" ADD COLUMN     "changed_by" TEXT,
ADD COLUMN     "note" VARCHAR(500);

-- AlterTable
ALTER TABLE "order_taxes" DROP CONSTRAINT "order_taxes_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "order_taxes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "paid_at",
DROP COLUMN "shipping_method",
DROP COLUMN "tracking_reference",
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "courier_id" TEXT,
ADD COLUMN     "courier_name" VARCHAR(100),
ADD COLUMN     "delivery_zone_id" TEXT,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "tracking_number" TEXT,
ADD COLUMN     "wallet_amount_used" DECIMAL(18,4) NOT NULL DEFAULT 0,
ALTER COLUMN "customer_phone" SET NOT NULL,
ALTER COLUMN "coupon_code" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "currency" SET DEFAULT 'BDT',
ALTER COLUMN "currency_rate" SET DEFAULT 1,
ALTER COLUMN "locale" SET DEFAULT 'bn-BD';

-- AlterTable
ALTER TABLE "price_history" DROP COLUMN "created_at",
ADD COLUMN     "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "changed_by" TEXT;

-- AlterTable
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_pkey",
DROP COLUMN "assigned_at",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_tags" DROP CONSTRAINT "product_tags_pkey",
DROP COLUMN "assigned_at",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "product_tags_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "barcode" VARCHAR(100),
ADD COLUMN     "height" DECIMAL(10,2),
ADD COLUMN     "length" DECIMAL(10,2),
ADD COLUMN     "low_stock_threshold" INTEGER,
ADD COLUMN     "reserved_qty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weight" DECIMAL(10,2),
ADD COLUMN     "width" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "dimensions",
ADD COLUMN     "average_rating" DECIMAL(3,2),
ADD COLUMN     "height" VARCHAR(100),
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" VARCHAR(100),
ADD COLUMN     "low_stock_threshold" INTEGER,
ADD COLUMN     "max_price" DECIMAL(18,4),
ADD COLUMN     "min_price" DECIMAL(18,4),
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "width" VARCHAR(100);

-- AlterTable
ALTER TABLE "queue_jobs" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "search_terms" DROP COLUMN "deleted_at",
DROP COLUMN "deleted_by",
DROP COLUMN "hits",
DROP COLUMN "results",
DROP COLUMN "updated_at",
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "last_used_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tax_classes" ADD COLUMN     "description" VARCHAR(500);

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "refunds",
DROP COLUMN "status",
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL,
ADD COLUMN     "reference" VARCHAR(255);

-- AlterTable
ALTER TABLE "variations" DROP COLUMN "position";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "carts";

-- DropTable
DROP TABLE "files";

-- DropTable
DROP TABLE "option_values";

-- DropTable
DROP TABLE "options";

-- DropTable
DROP TABLE "order_product_option_values";

-- DropTable
DROP TABLE "order_product_options";

-- DropTable
DROP TABLE "order_product_variation_values";

-- DropTable
DROP TABLE "order_product_variations";

-- DropTable
DROP TABLE "product_options";

-- DropTable
DROP TABLE "shipping_rates";

-- DropTable
DROP TABLE "shipping_zones";

-- DropTable
DROP TABLE "wish_lists";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "OptionPriceType";

-- DropEnum
DROP TYPE "OptionType";

-- DropEnum
DROP TYPE "PublishStatus";

-- DropEnum
DROP TYPE "ShippingMethod";

-- DropEnum
DROP TYPE "ShippingRateType";

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" TEXT NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "delivery_zone_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "session_id" TEXT,
    "cart_snapshot" JSONB NOT NULL,
    "address_id" TEXT,
    "address_snapshot" JSONB NOT NULL,
    "delivery_zone_id" TEXT,
    "courier_id" TEXT,
    "shipping_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "coupon_id" TEXT,
    "coupon_code" VARCHAR(50),
    "coupon_discount_type" "CouponDiscountType",
    "coupon_discount_value" DECIMAL(18,4),
    "wallet_amount_used" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sub_total" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "gateway_ref" VARCHAR(255),
    "gateway_response" JSONB,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "division_id" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "phone" VARCHAR(20),
    "order_id" TEXT NOT NULL,
    "discount_applied" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(20),
    "website" TEXT,
    "logo" TEXT,
    "api_key" VARCHAR(255),
    "tracking_url_template" VARCHAR(500),
    "api_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "color" "CustomerTagColor" NOT NULL DEFAULT 'GRAY',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divisions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_returns" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "items" JSONB NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "reason_detail" VARCHAR(500),
    "evidence_images" JSONB,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(500),
    "pickup_package_id" TEXT,
    "inspected_by" TEXT,
    "inspected_at" TIMESTAMP(3),
    "inspection_note" VARCHAR(500),
    "refund_id" TEXT,
    "wallet_credit_amount" DECIMAL(18,4),
    "refund_method" VARCHAR(20),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_answers" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "admin_id" TEXT,
    "customer_id" TEXT,
    "answerer_name" VARCHAR(100) NOT NULL,
    "answer" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "helpful_votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "product_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "asker_name" VARCHAR(100) NOT NULL,
    "question" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_answered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rules" (
    "id" TEXT NOT NULL,
    "delivery_zone_id" TEXT NOT NULL,
    "courier_id" TEXT NOT NULL,
    "rate_type" "ShippingRuleType" NOT NULL DEFAULT 'FLAT',
    "base_cost" DECIMAL(18,4) NOT NULL,
    "per_kg_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "free_shipping_minimum" DECIMAL(18,4),
    "estimated_min_days" INTEGER NOT NULL DEFAULT 1,
    "estimated_max_days" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_redirects" (
    "id" TEXT NOT NULL,
    "from_path" VARCHAR(500) NOT NULL,
    "to_path" VARCHAR(500) NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "entity_type" VARCHAR(50),
    "entity_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "url_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL,
    "order_id" TEXT,
    "return_id" TEXT,
    "reference_id" TEXT,
    "description" VARCHAR(255),
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_slug_key" ON "areas"("slug");

-- CreateIndex
CREATE INDEX "areas_city_id_idx" ON "areas"("city_id");

-- CreateIndex
CREATE INDEX "areas_postal_code_idx" ON "areas"("postal_code");

-- CreateIndex
CREATE INDEX "areas_delivery_zone_id_idx" ON "areas"("delivery_zone_id");

-- CreateIndex
CREATE INDEX "areas_is_active_idx" ON "areas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "areas_city_id_slug_key" ON "areas"("city_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_order_id_key" ON "checkout_sessions"("order_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_customer_id_idx" ON "checkout_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_session_id_idx" ON "checkout_sessions"("session_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_gateway_ref_idx" ON "checkout_sessions"("gateway_ref");

-- CreateIndex
CREATE INDEX "checkout_sessions_status_idx" ON "checkout_sessions"("status");

-- CreateIndex
CREATE INDEX "checkout_sessions_expires_at_idx" ON "checkout_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "checkout_sessions_order_id_idx" ON "checkout_sessions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_division_id_idx" ON "cities"("division_id");

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE INDEX "cities_slug_idx" ON "cities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cities_division_id_name_key" ON "cities"("division_id", "name");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_usages_customer_id_idx" ON "coupon_usages"("customer_id");

-- CreateIndex
CREATE INDEX "coupon_usages_order_id_idx" ON "coupon_usages"("order_id");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_customer_id_idx" ON "coupon_usages"("coupon_id", "customer_id");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_phone_idx" ON "coupon_usages"("coupon_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "couriers_name_key" ON "couriers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "couriers_slug_key" ON "couriers"("slug");

-- CreateIndex
CREATE INDEX "couriers_slug_idx" ON "couriers"("slug");

-- CreateIndex
CREATE INDEX "couriers_is_active_idx" ON "couriers"("is_active");

-- CreateIndex
CREATE INDEX "couriers_deleted_at_idx" ON "couriers"("deleted_at");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_is_pinned_idx" ON "customer_notes"("customer_id", "is_pinned");

-- CreateIndex
CREATE INDEX "customer_notes_deleted_at_idx" ON "customer_notes"("deleted_at");

-- CreateIndex
CREATE INDEX "customer_tags_customer_id_idx" ON "customer_tags"("customer_id");

-- CreateIndex
CREATE INDEX "customer_tags_label_idx" ON "customer_tags"("label");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_customer_id_label_key" ON "customer_tags"("customer_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_name_key" ON "delivery_zones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_slug_key" ON "delivery_zones"("slug");

-- CreateIndex
CREATE INDEX "delivery_zones_is_active_idx" ON "delivery_zones"("is_active");

-- CreateIndex
CREATE INDEX "delivery_zones_deleted_at_idx" ON "delivery_zones"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_slug_key" ON "divisions"("slug");

-- CreateIndex
CREATE INDEX "divisions_is_active_idx" ON "divisions"("is_active");

-- CreateIndex
CREATE INDEX "divisions_deleted_at_idx" ON "divisions"("deleted_at");

-- CreateIndex
CREATE INDEX "order_returns_order_id_idx" ON "order_returns"("order_id");

-- CreateIndex
CREATE INDEX "order_returns_customer_id_idx" ON "order_returns"("customer_id");

-- CreateIndex
CREATE INDEX "order_returns_status_idx" ON "order_returns"("status");

-- CreateIndex
CREATE INDEX "order_returns_created_at_idx" ON "order_returns"("created_at");

-- CreateIndex
CREATE INDEX "order_returns_deleted_at_idx" ON "order_returns"("deleted_at");

-- CreateIndex
CREATE INDEX "product_answers_question_id_is_published_idx" ON "product_answers"("question_id", "is_published");

-- CreateIndex
CREATE INDEX "product_answers_helpful_votes_idx" ON "product_answers"("helpful_votes");

-- CreateIndex
CREATE INDEX "product_answers_deleted_at_idx" ON "product_answers"("deleted_at");

-- CreateIndex
CREATE INDEX "product_questions_product_id_is_published_idx" ON "product_questions"("product_id", "is_published");

-- CreateIndex
CREATE INDEX "product_questions_customer_id_idx" ON "product_questions"("customer_id");

-- CreateIndex
CREATE INDEX "product_questions_is_answered_idx" ON "product_questions"("is_answered");

-- CreateIndex
CREATE INDEX "product_questions_deleted_at_idx" ON "product_questions"("deleted_at");

-- CreateIndex
CREATE INDEX "shipping_rules_delivery_zone_id_idx" ON "shipping_rules"("delivery_zone_id");

-- CreateIndex
CREATE INDEX "shipping_rules_courier_id_idx" ON "shipping_rules"("courier_id");

-- CreateIndex
CREATE INDEX "shipping_rules_is_active_idx" ON "shipping_rules"("is_active");

-- CreateIndex
CREATE INDEX "shipping_rules_deleted_at_idx" ON "shipping_rules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rules_delivery_zone_id_courier_id_key" ON "shipping_rules"("delivery_zone_id", "courier_id");

-- CreateIndex
CREATE UNIQUE INDEX "url_redirects_from_path_key" ON "url_redirects"("from_path");

-- CreateIndex
CREATE INDEX "url_redirects_from_path_idx" ON "url_redirects"("from_path");

-- CreateIndex
CREATE INDEX "url_redirects_entity_type_entity_id_idx" ON "url_redirects"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "url_redirects_is_active_idx" ON "url_redirects"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_customer_id_key" ON "wallets"("customer_id");

-- CreateIndex
CREATE INDEX "wallets_customer_id_idx" ON "wallets"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "wallet_transactions_order_id_idx" ON "wallet_transactions"("order_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "addresses_area_id_idx" ON "addresses"("area_id");

-- CreateIndex
CREATE INDEX "addresses_customer_id_is_default_idx" ON "addresses"("customer_id", "is_default");

-- CreateIndex
CREATE INDEX "addresses_customer_id_deleted_at_idx" ON "addresses"("customer_id", "deleted_at");

-- CreateIndex
CREATE INDEX "api_keys_owner_id_idx" ON "api_keys"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_type_admin_id_revoked_idx" ON "auth_tokens"("user_type", "admin_id", "revoked");

-- CreateIndex
CREATE INDEX "auth_tokens_user_type_customer_id_revoked_idx" ON "auth_tokens"("user_type", "customer_id", "revoked");

-- CreateIndex
CREATE INDEX "auth_tokens_device_id_revoked_idx" ON "auth_tokens"("device_id", "revoked");

-- CreateIndex
CREATE INDEX "categories_is_active_depth_position_idx" ON "categories"("is_active", "depth", "position");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "coupons_valid_from_valid_to_idx" ON "coupons"("valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "customers_phone_deleted_at_idx" ON "customers"("phone", "deleted_at");

-- CreateIndex
CREATE INDEX "devices_admin_id_idx" ON "devices"("admin_id");

-- CreateIndex
CREATE INDEX "devices_customer_id_idx" ON "devices"("customer_id");

-- CreateIndex
CREATE INDEX "flash_sale_products_product_variant_id_idx" ON "flash_sale_products"("product_variant_id");

-- CreateIndex
CREATE INDEX "flash_sale_products_is_active_idx" ON "flash_sale_products"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "flash_sale_products_flash_sale_id_product_id_product_varian_key" ON "flash_sale_products"("flash_sale_id", "product_id", "product_variant_id");

-- CreateIndex
CREATE INDEX "flash_sales_status_start_time_end_time_idx" ON "flash_sales"("status", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "flash_sales_is_active_status_idx" ON "flash_sales"("is_active", "status");

-- CreateIndex
CREATE INDEX "inventory_logs_flash_sale_product_id_idx" ON "inventory_logs"("flash_sale_product_id");

-- CreateIndex
CREATE INDEX "inventory_logs_product_id_created_at_idx" ON "inventory_logs"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "media_mime_type_idx" ON "media"("mime_type");

-- CreateIndex
CREATE INDEX "media_storage_driver_deleted_at_idx" ON "media"("storage_driver", "deleted_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_recipient_type_idx" ON "notifications"("recipient_id", "recipient_type");

-- CreateIndex
CREATE INDEX "order_packages_courier_id_idx" ON "order_packages"("courier_id");

-- CreateIndex
CREATE INDEX "order_taxes_order_id_idx" ON "order_taxes"("order_id");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "price_history_changed_at_idx" ON "price_history"("changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_product_id_attribute_id_key" ON "product_attributes"("product_id", "attribute_id");

-- CreateIndex
CREATE INDEX "product_categories_product_id_idx" ON "product_categories"("product_id");

-- CreateIndex
CREATE INDEX "product_categories_category_id_position_idx" ON "product_categories"("category_id", "position");

-- CreateIndex
CREATE INDEX "product_categories_category_id_is_primary_idx" ON "product_categories"("category_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_product_id_category_id_key" ON "product_categories"("product_id", "category_id");

-- CreateIndex
CREATE INDEX "product_tags_product_id_idx" ON "product_tags"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_tags_product_id_tag_id_key" ON "product_tags"("product_id", "tag_id");

-- CreateIndex
CREATE INDEX "product_variants_barcode_idx" ON "product_variants"("barcode");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_default_idx" ON "product_variants"("product_id", "is_default");

-- CreateIndex
CREATE INDEX "product_variants_product_id_position_idx" ON "product_variants"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_variants_qty_idx" ON "product_variants"("qty");

-- CreateIndex
CREATE INDEX "products_viewed_idx" ON "products"("viewed");

-- CreateIndex
CREATE INDEX "products_average_rating_idx" ON "products"("average_rating");

-- CreateIndex
CREATE INDEX "products_is_featured_is_active_idx" ON "products"("is_featured", "is_active");

-- CreateIndex
CREATE INDEX "products_min_price_max_price_idx" ON "products"("min_price", "max_price");

-- CreateIndex
CREATE INDEX "products_is_active_is_featured_average_rating_idx" ON "products"("is_active", "is_featured", "average_rating");

-- CreateIndex
CREATE INDEX "search_terms_term_idx" ON "search_terms"("term");

-- CreateIndex
CREATE INDEX "search_terms_count_idx" ON "search_terms"("count");

-- CreateIndex
CREATE INDEX "search_terms_last_used_at_idx" ON "search_terms"("last_used_at");

-- CreateIndex
CREATE INDEX "stock_reservations_customer_id_idx" ON "stock_reservations"("customer_id");

-- CreateIndex
CREATE INDEX "transactions_payment_status_idx" ON "transactions"("payment_status");

-- CreateIndex
CREATE INDEX "variations_uid_idx" ON "variations"("uid");

-- CreateIndex
CREATE INDEX "verification_otps_target_purpose_verified_expires_at_idx" ON "verification_otps"("target", "purpose", "verified", "expires_at");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_answers" ADD CONSTRAINT "product_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "product_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_rules_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_rules_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

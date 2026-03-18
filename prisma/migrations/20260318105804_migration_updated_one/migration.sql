-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_PRODUCTS';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_COUPONS';
ALTER TYPE "AdminPermission" ADD VALUE 'VIEW_PRODUCTS';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_PROMOTIONS';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_SHIPPING';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_CURRENCIES';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_TAX';

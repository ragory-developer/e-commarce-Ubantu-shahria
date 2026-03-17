-- AlterEnum
ALTER TYPE "VariationType" ADD VALUE 'DROPDOWN';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "updated_by" TEXT;

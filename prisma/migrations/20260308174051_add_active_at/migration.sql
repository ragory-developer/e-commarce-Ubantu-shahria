/*
  Warnings:

  - You are about to drop the column `pathIds` on the `categories` table. All the data in the column will be lost.
  - You are about to alter the column `path` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.

*/
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "pathIds",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "path_ids" VARCHAR(1000),
ALTER COLUMN "path" SET DATA TYPE VARCHAR(1000);

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path");

-- CreateIndex
CREATE INDEX "categories_path_ids_idx" ON "categories"("path_ids");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

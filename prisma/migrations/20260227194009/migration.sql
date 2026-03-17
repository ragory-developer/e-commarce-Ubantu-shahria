-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "filename" VARCHAR(191) NOT NULL,
    "original_name" VARCHAR(191) NOT NULL,
    "mime_Type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "storage_driver" VARCHAR(20) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "storage_url" VARCHAR(500) NOT NULL,
    "variants" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "alt" VARCHAR(191),
    "reference_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_media" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "purpose" VARCHAR(50),
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_storage_driver_idx" ON "media"("storage_driver");

-- CreateIndex
CREATE INDEX "media_mime_Type_idx" ON "media"("mime_Type");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE INDEX "media_deleted_at_idx" ON "media"("deleted_at");

-- CreateIndex
CREATE INDEX "media_reference_count_idx" ON "media"("reference_count");

-- CreateIndex
CREATE INDEX "entity_media_entity_type_entity_id_idx" ON "entity_media"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entity_media_media_id_idx" ON "entity_media"("media_id");

-- CreateIndex
CREATE INDEX "entity_media_is_main_idx" ON "entity_media"("is_main");

-- CreateIndex
CREATE UNIQUE INDEX "entity_media_entity_type_entity_id_media_id_key" ON "entity_media"("entity_type", "entity_id", "media_id");

-- AddForeignKey
ALTER TABLE "entity_media" ADD CONSTRAINT "entity_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

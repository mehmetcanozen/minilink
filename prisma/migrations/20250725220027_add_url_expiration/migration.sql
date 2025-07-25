-- CreateTable
CREATE TABLE "urls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "original_url" TEXT NOT NULL,
    "short_slug" VARCHAR(20) NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "user_id" UUID,

    CONSTRAINT "urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "urls_short_slug_key" ON "urls"("short_slug");

-- CreateIndex
CREATE INDEX "idx_urls_short_slug" ON "urls"("short_slug");

-- CreateIndex
CREATE INDEX "idx_urls_original_url" ON "urls"("original_url");

-- CreateIndex
CREATE INDEX "idx_urls_created_at" ON "urls"("created_at");

-- CreateIndex
CREATE INDEX "idx_urls_expires_at" ON "urls"("expires_at");

-- CreateIndex
CREATE INDEX "idx_urls_user_id" ON "urls"("user_id");

-- CreateTable
CREATE TABLE "ai_api_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "filters" JSONB,
    "rate_limited" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_api_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_api_audit_org_created" ON "ai_api_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ai_api_audit_key_created" ON "ai_api_audit_logs"("key_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_api_audit_logs" ADD CONSTRAINT "ai_api_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

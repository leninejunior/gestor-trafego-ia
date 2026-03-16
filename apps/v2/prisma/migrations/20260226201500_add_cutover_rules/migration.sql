-- CreateEnum
CREATE TYPE "CutoverRoute" AS ENUM ('V1', 'V2');

-- CreateTable
CREATE TABLE "cutover_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "group_id" TEXT,
    "route" "CutoverRoute" NOT NULL DEFAULT 'V1',
    "rollout_percent" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutover_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cutover_rule_org_active" ON "cutover_rules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_cutover_rule_org_group_active" ON "cutover_rules"("organization_id", "group_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_cutover_rule_org_client_active" ON "cutover_rules"("organization_id", "client_id", "is_active");

-- AddForeignKey
ALTER TABLE "cutover_rules" ADD CONSTRAINT "cutover_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutover_rules" ADD CONSTRAINT "cutover_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

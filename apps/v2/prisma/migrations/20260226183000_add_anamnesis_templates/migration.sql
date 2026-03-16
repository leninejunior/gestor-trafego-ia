-- CreateEnum
CREATE TYPE "AnamnesisSpecialty" AS ENUM ('ESTETICA', 'PSICOLOGIA', 'CLINICA_GERAL');

-- CreateTable
CREATE TABLE "anamnesis_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "specialty" "AnamnesisSpecialty" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "form_schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anamnesis_templates_tenant_specialty_active_idx"
ON "anamnesis_templates"("tenant_id", "specialty", "is_active");

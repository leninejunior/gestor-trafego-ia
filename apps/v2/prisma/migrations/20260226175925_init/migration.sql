-- CreateTable
CREATE TABLE "healthchecks" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healthchecks_pkey" PRIMARY KEY ("id")
);

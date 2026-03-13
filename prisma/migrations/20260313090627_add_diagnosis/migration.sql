-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scores" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '{}',
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "categoryA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoryB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoryC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoryD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Diagnosis_projectId_idx" ON "Diagnosis"("projectId");

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

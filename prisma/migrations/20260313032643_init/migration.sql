-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "openaiApiKey" TEXT,
    "geminiApiKey" TEXT,
    "claudeApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL DEFAULT '',
    "targetDomain" TEXT NOT NULL DEFAULT '',
    "targetServices" TEXT NOT NULL DEFAULT '[]',
    "targetCustomer" TEXT NOT NULL DEFAULT '',
    "ruleMaking" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "doneSteps" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResult" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "promptIndex" INTEGER NOT NULL DEFAULT 0,
    "promptText" TEXT NOT NULL DEFAULT '',
    "modelVariant" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "searchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "responseText" TEXT NOT NULL DEFAULT '',
    "responseTimeMs" INTEGER,
    "serviceMentions" TEXT NOT NULL DEFAULT '{}',
    "targetDomainCited" BOOLEAN NOT NULL DEFAULT false,
    "citedUrls" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "surveyId" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "openaiScore" DOUBLE PRECISION NOT NULL,
    "geminiScore" DOUBLE PRECISION NOT NULL,
    "claudeScore" DOUBLE PRECISION NOT NULL,
    "keywordCoverage" DOUBLE PRECISION NOT NULL,
    "citationRate" DOUBLE PRECISION NOT NULL,
    "avgPosition" DOUBLE PRECISION,
    "mentionBreakdown" TEXT NOT NULL,
    "promptScores" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "weaknesses" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analysisId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "suggestedContent" TEXT,
    "targetPrompts" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Survey_projectId_idx" ON "Survey"("projectId");

-- CreateIndex
CREATE INDEX "SurveyResult_surveyId_idx" ON "SurveyResult"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResult_surveyId_promptIndex_modelVariant_key" ON "SurveyResult"("surveyId", "promptIndex", "modelVariant");

-- CreateIndex
CREATE INDEX "Analysis_projectId_idx" ON "Analysis"("projectId");

-- CreateIndex
CREATE INDEX "Recommendation_projectId_idx" ON "Recommendation"("projectId");

-- CreateIndex
CREATE INDEX "Recommendation_priority_idx" ON "Recommendation"("priority");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResult" ADD CONSTRAINT "SurveyResult_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

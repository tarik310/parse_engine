-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DatasetInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ingestionMethod" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DatasetInput_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "outputSchema" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtractionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0,
    "numCtx" INTEGER,
    "think" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "totalProcessingTimeSeconds" REAL NOT NULL DEFAULT 0,
    "lastSuccessfulInputLabel" TEXT,
    "currentInputLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractionJob_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "Instruction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractionJob_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inputLabel" TEXT,
    "contentHash" TEXT NOT NULL,
    "extractionJobId" TEXT NOT NULL,
    "datasetInputId" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingDurationSeconds" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "renderedPrompt" TEXT,
    "rawResponse" TEXT,
    "totalDuration" REAL,
    "loadDuration" REAL,
    "promptEvalCount" INTEGER,
    "promptEvalDuration" REAL,
    "evalCount" INTEGER,
    "evalDuration" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractionResult_extractionJobId_fkey" FOREIGN KEY ("extractionJobId") REFERENCES "ExtractionJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractionResult_datasetInputId_fkey" FOREIGN KEY ("datasetInputId") REFERENCES "DatasetInput" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_name_key" ON "Dataset"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_slug_key" ON "Dataset"("slug");

-- CreateIndex
CREATE INDEX "DatasetInput_datasetId_idx" ON "DatasetInput"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetInput_contentHash_datasetId_key" ON "DatasetInput"("contentHash", "datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetInput_label_datasetId_key" ON "DatasetInput"("label", "datasetId");

-- CreateIndex
CREATE INDEX "ExtractionResult_extractionJobId_status_idx" ON "ExtractionResult"("extractionJobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionResult_datasetInputId_extractionJobId_key" ON "ExtractionResult"("datasetInputId", "extractionJobId");

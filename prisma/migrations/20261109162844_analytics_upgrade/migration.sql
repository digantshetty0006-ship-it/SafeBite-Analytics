-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "tier" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "snapshotAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "riskScore" REAL NOT NULL DEFAULT 50,
    "riskTier" TEXT NOT NULL DEFAULT 'B',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Business" ("address", "category", "district", "id", "lat", "licenseNumber", "lng", "name", "ownerId", "registeredAt", "riskScore", "riskTier", "supplier") SELECT "address", "category", "district", "id", "lat", "licenseNumber", "lng", "name", "ownerId", "registeredAt", "riskScore", "riskTier", "supplier" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE INDEX "Business_district_idx" ON "Business"("district");
CREATE INDEX "Business_category_idx" ON "Business"("category");
CREATE INDEX "Business_riskTier_idx" ON "Business"("riskTier");
CREATE INDEX "Business_status_idx" ON "Business"("status");
CREATE INDEX "Business_licenseNumber_idx" ON "Business"("licenseNumber");
CREATE TABLE "new_Complaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT,
    "citizenId" TEXT,
    "assignedOfficerId" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" DATETIME,
    "investigationStartedAt" DATETIME,
    "inspectionAt" DATETIME,
    "resolvedAt" DATETIME,
    "slaDays" INTEGER NOT NULL DEFAULT 7,
    "lat" REAL,
    "lng" REAL,
    "address" TEXT,
    "district" TEXT,
    "aiAnalysis" TEXT,
    CONSTRAINT "Complaint_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Complaint_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Complaint_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Complaint" ("address", "aiAnalysis", "anonymous", "assignedOfficerId", "businessId", "citizenId", "createdAt", "description", "district", "id", "lat", "lng", "photos", "status", "type") SELECT "address", "aiAnalysis", "anonymous", "assignedOfficerId", "businessId", "citizenId", "createdAt", "description", "district", "id", "lat", "lng", "photos", "status", "type" FROM "Complaint";
DROP TABLE "Complaint";
ALTER TABLE "new_Complaint" RENAME TO "Complaint";
CREATE INDEX "Complaint_businessId_idx" ON "Complaint"("businessId");
CREATE INDEX "Complaint_assignedOfficerId_idx" ON "Complaint"("assignedOfficerId");
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");
CREATE INDEX "Complaint_createdAt_idx" ON "Complaint"("createdAt");
CREATE INDEX "Complaint_resolvedAt_idx" ON "Complaint"("resolvedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RiskSnapshot_businessId_snapshotAt_idx" ON "RiskSnapshot"("businessId", "snapshotAt");

-- CreateIndex
CREATE INDEX "RiskSnapshot_snapshotAt_idx" ON "RiskSnapshot"("snapshotAt");

-- CreateIndex
CREATE INDEX "Document_businessId_idx" ON "Document"("businessId");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "Inspection_businessId_idx" ON "Inspection"("businessId");

-- CreateIndex
CREATE INDEX "Inspection_officerId_idx" ON "Inspection"("officerId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_scheduledAt_idx" ON "Inspection"("scheduledAt");

-- CreateIndex
CREATE INDEX "Inspection_completedAt_idx" ON "Inspection"("completedAt");

-- CreateIndex
CREATE INDEX "Violation_inspectionId_idx" ON "Violation"("inspectionId");

-- CreateIndex
CREATE INDEX "Violation_type_idx" ON "Violation"("type");

-- CreateIndex
CREATE INDEX "Violation_severity_idx" ON "Violation"("severity");

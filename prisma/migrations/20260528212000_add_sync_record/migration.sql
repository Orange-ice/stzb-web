CREATE TABLE "SyncRecord" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "syncTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationType" TEXT NOT NULL,
    "syncedCount" INTEGER NOT NULL,
    "operatorRole" TEXT NOT NULL,
    "operatorAlliance" TEXT,
    "operatorServer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncRecord_seasonId_syncTime_idx" ON "SyncRecord"("seasonId", "syncTime");
CREATE INDEX "SyncRecord_syncTime_idx" ON "SyncRecord"("syncTime");

ALTER TABLE "SyncRecord"
ADD CONSTRAINT "SyncRecord_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

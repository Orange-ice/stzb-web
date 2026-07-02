-- AlterTable: SeasonMember 增加同步状态字段
ALTER TABLE "SeasonMember" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "SeasonMember" ADD COLUMN "lastSyncBatchId" TEXT;
ALTER TABLE "SeasonMember" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX "SeasonMember_seasonId_status_idx" ON "SeasonMember"("seasonId", "status");

-- AlterTable: SyncRecord 扩展成员同步统计字段
ALTER TABLE "SyncRecord" ADD COLUMN "syncBatchId" TEXT;
ALTER TABLE "SyncRecord" ADD COLUMN "createdCount" INTEGER;
ALTER TABLE "SyncRecord" ADD COLUMN "updatedCount" INTEGER;
ALTER TABLE "SyncRecord" ADD COLUMN "markedWild" INTEGER;
ALTER TABLE "SyncRecord" ADD COLUMN "snapshotCount" INTEGER;
ALTER TABLE "SyncRecord" ADD COLUMN "invalidCount" INTEGER;
ALTER TABLE "SyncRecord" ADD COLUMN "errorMessage" TEXT;

-- CreateTable: 成员周武勋快照
CREATE TABLE "SeasonMemberWuSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "syncBatchId" TEXT NOT NULL,
    "playerIdInGame" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "groupName" TEXT,
    "weekNo" INTEGER NOT NULL,
    "wu" INTEGER NOT NULL,
    "power" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonMemberWuSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SeasonMemberWuSnapshot_seasonId_playerIdInGame_weekNo_idx" ON "SeasonMemberWuSnapshot"("seasonId", "playerIdInGame", "weekNo");
CREATE INDEX "SeasonMemberWuSnapshot_seasonId_weekNo_idx" ON "SeasonMemberWuSnapshot"("seasonId", "weekNo");

ALTER TABLE "SeasonMemberWuSnapshot"
ADD CONSTRAINT "SeasonMemberWuSnapshot_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

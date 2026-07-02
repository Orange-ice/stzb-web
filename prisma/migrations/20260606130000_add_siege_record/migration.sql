-- CreateTable: 成员攻城记录
CREATE TABLE "SeasonMemberSiegeRecord" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "localTaskId" INTEGER NOT NULL,
    "playerIdInGame" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "taskName" TEXT,
    "targetName" TEXT,
    "targetPosition" TEXT,
    "finishedAt" TIMESTAMP(3),
    "mainCount" INTEGER NOT NULL DEFAULT 0,
    "demolishCount" INTEGER NOT NULL DEFAULT 0,
    "mainTimes" INTEGER NOT NULL DEFAULT 0,
    "demolishTimes" INTEGER NOT NULL DEFAULT 0,
    "syncBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonMemberSiegeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonMemberSiegeRecord_seasonId_localTaskId_playerIdInGame_key" ON "SeasonMemberSiegeRecord"("seasonId", "localTaskId", "playerIdInGame");
CREATE INDEX "SeasonMemberSiegeRecord_seasonId_playerIdInGame_idx" ON "SeasonMemberSiegeRecord"("seasonId", "playerIdInGame");

ALTER TABLE "SeasonMemberSiegeRecord"
ADD CONSTRAINT "SeasonMemberSiegeRecord_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

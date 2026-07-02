-- CreateTable: 队伍胜率（按玩家+队伍聚合，来源桌面端战报）
CREATE TABLE "SeasonTeamWinRate" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "hero1Id" INTEGER NOT NULL,
    "hero2Id" INTEGER NOT NULL,
    "hero3Id" INTEGER NOT NULL,
    "hero1Level" INTEGER,
    "hero2Level" INTEGER,
    "hero3Level" INTEGER,
    "hero1Star" INTEGER,
    "hero2Star" INTEGER,
    "hero3Star" INTEGER,
    "totalStar" INTEGER,
    "totalBattles" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "drawCount" INTEGER NOT NULL DEFAULT 0,
    "lossCount" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT,
    "allSkillInfo" TEXT,
    "lastTime" INTEGER,
    "syncBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonTeamWinRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonTeamWinRate_seasonId_playerName_hero1Id_hero2Id_hero3I_key" ON "SeasonTeamWinRate"("seasonId", "playerName", "hero1Id", "hero2Id", "hero3Id");
CREATE INDEX "SeasonTeamWinRate_seasonId_playerName_idx" ON "SeasonTeamWinRate"("seasonId", "playerName");

ALTER TABLE "SeasonTeamWinRate"
ADD CONSTRAINT "SeasonTeamWinRate_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

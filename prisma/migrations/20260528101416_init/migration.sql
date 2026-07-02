-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMember" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerIdInGame" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "groupName" TEXT,
    "power" INTEGER,
    "wu" INTEGER,
    "contributeTotal" INTEGER,
    "contributeWeek" INTEGER,
    "pos" INTEGER,
    "joinTime" INTEGER,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonTeamSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "unionName" TEXT,
    "idu" TEXT,
    "role" TEXT NOT NULL,
    "battleId" INTEGER,
    "snapshotTime" TIMESTAMP(3),
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
    "allSkillInfo" TEXT,
    "gearInfo" TEXT,
    "heroType" TEXT,
    "sourceHash" TEXT NOT NULL,
    "sourceClientId" TEXT,
    "syncBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonTeamSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_code_key" ON "Season"("code");

-- CreateIndex
CREATE INDEX "SeasonMember_seasonId_playerName_idx" ON "SeasonMember"("seasonId", "playerName");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMember_seasonId_playerIdInGame_key" ON "SeasonMember"("seasonId", "playerIdInGame");

-- CreateIndex
CREATE INDEX "SeasonTeamSnapshot_seasonId_playerName_idx" ON "SeasonTeamSnapshot"("seasonId", "playerName");

-- CreateIndex
CREATE INDEX "SeasonTeamSnapshot_seasonId_unionName_idx" ON "SeasonTeamSnapshot"("seasonId", "unionName");

-- CreateIndex
CREATE INDEX "SeasonTeamSnapshot_seasonId_idu_idx" ON "SeasonTeamSnapshot"("seasonId", "idu");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonTeamSnapshot_seasonId_sourceHash_key" ON "SeasonTeamSnapshot"("seasonId", "sourceHash");

-- AddForeignKey
ALTER TABLE "SeasonMember" ADD CONSTRAINT "SeasonMember_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTeamSnapshot" ADD CONSTRAINT "SeasonTeamSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

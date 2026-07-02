ALTER TABLE "SeasonTeamSnapshot"
ADD COLUMN "isFriendly" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX "SeasonTeamSnapshot_seasonId_sourceHash_key";

CREATE UNIQUE INDEX "SeasonTeamSnapshot_seasonId_sourceHash_isFriendly_key"
ON "SeasonTeamSnapshot"("seasonId", "sourceHash", "isFriendly");

CREATE INDEX "SeasonTeamSnapshot_seasonId_isFriendly_idx"
ON "SeasonTeamSnapshot"("seasonId", "isFriendly");

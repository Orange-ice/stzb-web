ALTER TABLE "Season"
ADD COLUMN "isMobileTeamDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Season_isMobileTeamDefault_idx"
ON "Season"("isMobileTeamDefault");

CREATE UNIQUE INDEX "Season_mobile_team_default_true_key"
ON "Season"("isMobileTeamDefault")
WHERE "isMobileTeamDefault" = true;

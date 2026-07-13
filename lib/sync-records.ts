import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";

type TeamSnapshotInput = {
  playerName: string;
  unionName?: string;
  idu?: string;
  role: string;
  battleId?: number;
  snapshotTime?: number;
  hero1Id: number;
  hero2Id: number;
  hero3Id: number;
  hero1Level?: number;
  hero2Level?: number;
  hero3Level?: number;
  hero1Star?: number;
  hero2Star?: number;
  hero3Star?: number;
  totalStar?: number;
  allSkillInfo?: string;
  gearInfo?: string;
  heroType?: string;
};

export type TeamSyncPayload = {
  seasonCode: string;
  operationType: string;
  operatorRole: string;
  operatorAlliance?: string;
  operatorServer?: string;
  items: TeamSnapshotInput[];
};

function normalizeAllianceName(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function makeSourceHash(item: TeamSnapshotInput) {
  const raw = [
    item.playerName ?? "",
    item.unionName ?? "",
    item.idu ?? "",
    item.role ?? "",
    item.battleId ?? 0,
    item.hero1Id ?? 0,
    item.hero2Id ?? 0,
    item.hero3Id ?? 0,
    item.allSkillInfo ?? "",
    item.gearInfo ?? "",
    item.heroType ?? "",
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}

export async function syncSeasonTeams(payload: TeamSyncPayload) {
  const seasonCode = payload.seasonCode.trim().toLowerCase();
  const operatorRole = payload.operatorRole.trim();
  const operatorAlliance = payload.operatorAlliance?.trim() ?? "";
  const normalizedOperatorAlliance = normalizeAllianceName(operatorAlliance);

  if (!seasonCode) {
    throw new Error("赛季代号不能为空");
  }

  if (!operatorRole) {
    throw new Error("操作角色不能为空");
  }

  if (!normalizedOperatorAlliance) {
    throw new Error("操作人同盟名不能为空");
  }

  if (!payload.items.length) {
    throw new Error("没有可同步的队伍数据");
  }

  const season = await prisma.season.findUnique({
    where: { code: seasonCode },
  });

  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const prepared = payload.items.map((item) => ({
    seasonId: season.id,
    playerName: item.playerName,
    unionName: item.unionName ?? null,
    isFriendly: normalizeAllianceName(item.unionName) === normalizedOperatorAlliance,
    idu: item.idu ?? null,
    role: item.role,
    battleId: item.battleId ?? null,
    snapshotTime: item.snapshotTime ? new Date(item.snapshotTime * 1000) : null,
    hero1Id: item.hero1Id,
    hero2Id: item.hero2Id,
    hero3Id: item.hero3Id,
    hero1Level: item.hero1Level ?? null,
    hero2Level: item.hero2Level ?? null,
    hero3Level: item.hero3Level ?? null,
    hero1Star: item.hero1Star ?? null,
    hero2Star: item.hero2Star ?? null,
    hero3Star: item.hero3Star ?? null,
    totalStar: item.totalStar ?? null,
    allSkillInfo: item.allSkillInfo ?? null,
    gearInfo: item.gearInfo ?? null,
    heroType: item.heroType ?? null,
    sourceHash: makeSourceHash(item),
    sourceClientId: "wails-desktop",
    syncBatchId: null,
  }));

  const uniquePrepared = Array.from(
    new Map(prepared.map((item) => [`${item.seasonId}:${item.sourceHash}`, item])).values(),
  );

  await prisma.$transaction(async (tx) => {
    await tx.seasonTeamSnapshot.deleteMany({
      where: {
        seasonId: season.id,
      },
    });

    await tx.seasonTeamSnapshot.createMany({
      data: uniquePrepared,
    });

    await tx.syncRecord.create({
      data: {
        seasonId: season.id,
        operationType: payload.operationType,
        syncedCount: uniquePrepared.length,
        operatorRole,
        operatorAlliance: operatorAlliance || null,
        operatorServer: payload.operatorServer?.trim() || null,
      },
    });
  }, { maxWait: 60000, timeout: 60000 });

  return {
    syncedCount: uniquePrepared.length,
    seasonId: season.id,
    seasonCode: season.code,
  };
}

export async function listSyncRecords() {
  return prisma.syncRecord.findMany({
    include: {
      season: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: [{ syncTime: "desc" }],
    take: 100,
  });
}

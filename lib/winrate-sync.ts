import { prisma } from "@/lib/prisma";

export type WinRateInput = {
  playerName?: string;
  hero1Id?: number | null;
  hero2Id?: number | null;
  hero3Id?: number | null;
  hero1Level?: number | null;
  hero2Level?: number | null;
  hero3Level?: number | null;
  hero1Star?: number | null;
  hero2Star?: number | null;
  hero3Star?: number | null;
  totalStar?: number | null;
  totalBattles?: number | null;
  winCount?: number | null;
  drawCount?: number | null;
  lossCount?: number | null;
  role?: string;
  allSkillInfo?: string;
  lastTime?: number | null;
};

export type WinRateSyncPayload = {
  seasonCode: string;
  operatorRole: string;
  operatorAlliance?: string;
  operatorServer?: string;
  items: WinRateInput[];
};

function makeBatchId(now: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(
    now.getHours(),
  )}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function intOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function intOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export async function syncSeasonWinRates(payload: WinRateSyncPayload) {
  const seasonCode = payload.seasonCode.trim().toLowerCase();
  const operatorRole = payload.operatorRole.trim();
  const operatorAlliance = payload.operatorAlliance?.trim() ?? "";
  const operatorServer = payload.operatorServer?.trim() ?? "";

  if (!seasonCode) {
    throw new Error("赛季代号不能为空");
  }
  if (!operatorRole) {
    throw new Error("操作角色不能为空");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("没有可同步的胜率数据");
  }

  const season = await prisma.season.findUnique({ where: { code: seasonCode } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const now = new Date();
  const syncBatchId = makeBatchId(now);

  // 校验 + 去重（同一 玩家+队伍 保留最后一条）
  const map = new Map<string, WinRateInput>();
  for (const it of payload.items) {
    const name = it.playerName?.trim();
    const h1 = intOrNull(it.hero1Id);
    const h2 = intOrNull(it.hero2Id);
    const h3 = intOrNull(it.hero3Id);
    if (!name || h1 == null || h2 == null || h3 == null) {
      continue;
    }
    map.set(`${name}|${h1}|${h2}|${h3}`, it);
  }

  const prepared = Array.from(map.values()).map((it) => ({
    seasonId: season.id,
    playerName: (it.playerName as string).trim(),
    hero1Id: intOrZero(it.hero1Id),
    hero2Id: intOrZero(it.hero2Id),
    hero3Id: intOrZero(it.hero3Id),
    hero1Level: intOrNull(it.hero1Level),
    hero2Level: intOrNull(it.hero2Level),
    hero3Level: intOrNull(it.hero3Level),
    hero1Star: intOrNull(it.hero1Star),
    hero2Star: intOrNull(it.hero2Star),
    hero3Star: intOrNull(it.hero3Star),
    totalStar: intOrNull(it.totalStar),
    totalBattles: intOrZero(it.totalBattles),
    winCount: intOrZero(it.winCount),
    drawCount: intOrZero(it.drawCount),
    lossCount: intOrZero(it.lossCount),
    role: it.role ?? null,
    allSkillInfo: it.allSkillInfo ?? null,
    lastTime: intOrNull(it.lastTime),
    syncBatchId,
  }));

  if (prepared.length === 0) {
    throw new Error("没有有效的胜率数据");
  }

  // 全量替换：胜率每次由完整战报重算，删除旧数据后整批写入
  await prisma.$transaction(
    async (tx) => {
      await tx.seasonTeamWinRate.deleteMany({ where: { seasonId: season.id } });
      await tx.seasonTeamWinRate.createMany({ data: prepared });
      await tx.syncRecord.create({
        data: {
          seasonId: season.id,
          operationType: "winrate_sync",
          syncedCount: prepared.length,
          operatorRole,
          operatorAlliance: operatorAlliance || null,
          operatorServer: operatorServer || null,
          syncBatchId,
        },
      });
    },
    { timeout: 60000 },
  );

  return {
    syncedCount: prepared.length,
    syncBatchId,
    seasonCode: season.code,
  };
}

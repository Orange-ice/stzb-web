import { prisma } from "@/lib/prisma";

export type SiegeMemberInput = {
  playerIdInGame?: number | null;
  playerName?: string;
  mainCount?: number | null; // 主力数量 atk_team_num
  demolishCount?: number | null; // 拆迁数量 dis_team_num
  mainTimes?: number | null; // 主力次数 atk_num
  demolishTimes?: number | null; // 拆迁次数 dis_num
};

export type SiegeSyncPayload = {
  seasonCode: string;
  operatorRole: string;
  operatorAlliance?: string;
  operatorServer?: string;
  localTaskId?: number | null;
  taskName?: string;
  targetName?: string;
  targetPosition?: string;
  finishedAt?: number | null; // Unix 秒
  members: SiegeMemberInput[];
};

export type SiegeSyncResult = {
  received: number;
  recorded: number;
  ignored: number;
  unmatched: number;
  unmatchedPlayers: number[];
  syncBatchId: string;
  seasonCode: string;
};

function makeBatchId(now: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(
    now.getHours(),
  )}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function isValidPlayerId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function syncSeasonSiege(payload: SiegeSyncPayload): Promise<SiegeSyncResult> {
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
  if (!isValidPlayerId(payload.localTaskId)) {
    throw new Error("本地任务 ID 无效");
  }
  if (!Array.isArray(payload.members) || payload.members.length === 0) {
    throw new Error("没有可同步的攻城参与数据");
  }

  const season = await prisma.season.findUnique({ where: { code: seasonCode } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const localTaskId = payload.localTaskId as number;
  const received = payload.members.length;
  const finishedAt = payload.finishedAt ? new Date(payload.finishedAt * 1000) : null;
  const taskName = payload.taskName?.trim() || null;
  const targetName = payload.targetName?.trim() || null;
  const targetPosition = payload.targetPosition?.trim() || null;

  // 只保留 主力次数 + 拆迁次数 > 0 的成员（Web 端兜底过滤），其余计入 ignored
  // 同 playerIdInGame 去重，保留最后一条
  const validMap = new Map<number, SiegeMemberInput>();
  let ignored = 0;
  for (const m of payload.members) {
    if (!isValidPlayerId(m.playerIdInGame)) {
      ignored += 1;
      continue;
    }
    if (num(m.mainTimes) + num(m.demolishTimes) <= 0) {
      ignored += 1;
      continue;
    }
    validMap.set(m.playerIdInGame, m);
  }
  const validMembers = Array.from(validMap.values());

  const now = new Date();
  const syncBatchId = makeBatchId(now);

  const result = await prisma.$transaction(async (tx) => {
    // 已存在的赛季成员（用于统计 unmatched，但不影响是否写入）
    const memberRows = await tx.seasonMember.findMany({
      where: { seasonId: season.id },
      select: { playerIdInGame: true },
    });
    const memberIds = new Set(memberRows.map((r) => r.playerIdInGame));

    const unmatchedPlayers: number[] = [];

    for (const m of validMembers) {
      const playerIdInGame = m.playerIdInGame as number;
      if (!memberIds.has(playerIdInGame)) {
        unmatchedPlayers.push(playerIdInGame);
      }

      const data = {
        memberName: m.playerName ?? "",
        taskName,
        targetName,
        targetPosition,
        finishedAt,
        mainCount: num(m.mainCount),
        demolishCount: num(m.demolishCount),
        mainTimes: num(m.mainTimes),
        demolishTimes: num(m.demolishTimes),
        syncBatchId,
      };

      // 幂等：同一 (赛季, 本地任务, 玩家) 重复完结走更新，不重复追加
      await tx.seasonMemberSiegeRecord.upsert({
        where: {
          seasonId_localTaskId_playerIdInGame: {
            seasonId: season.id,
            localTaskId,
            playerIdInGame,
          },
        },
        create: { seasonId: season.id, localTaskId, playerIdInGame, ...data },
        update: data,
      });
    }

    await tx.syncRecord.create({
      data: {
        seasonId: season.id,
        operationType: "siege_sync",
        syncedCount: validMembers.length,
        operatorRole,
        operatorAlliance: operatorAlliance || null,
        operatorServer: operatorServer || null,
        syncBatchId,
      },
    });

    return { unmatchedPlayers };
  }, { timeout: 30000 });

  return {
    received,
    recorded: validMembers.length,
    ignored,
    unmatched: result.unmatchedPlayers.length,
    unmatchedPlayers: result.unmatchedPlayers,
    syncBatchId,
    seasonCode: season.code,
  };
}

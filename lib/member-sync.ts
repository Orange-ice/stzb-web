import { prisma } from "@/lib/prisma";
import { weekNoOf } from "@/lib/season-week";

export type MemberSyncInput = {
  playerIdInGame?: number | null;
  playerName?: string;
  groupName?: string | null;
  power?: number | null;
  wu?: number | null;
  contributeTotal?: number | null;
  contributeWeek?: number | null;
  pos?: number | null;
  joinTime?: number | null;
};

export type MemberSyncPayload = {
  seasonCode: string;
  operatorRole: string;
  operatorAlliance?: string;
  operatorServer?: string;
  members: MemberSyncInput[];
};

export type MemberSyncResult = {
  received: number;
  created: number;
  updated: number;
  markedWild: number;
  snapshotCount: number;
  invalidCount: number;
  syncBatchId: string;
  seasonCode: string;
};

function makeBatchId(now: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(
    now.getHours(),
  )}${p(now.getMinutes())}${p(now.getSeconds())}`;
  // 追加毫秒后三位，降低同秒内多次同步的批次号碰撞概率
  return `${stamp}${p(now.getMilliseconds() % 1000).padStart(3, "0")}`;
}

function isValidPlayerId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function syncSeasonMembers(payload: MemberSyncPayload): Promise<MemberSyncResult> {
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
  if (!Array.isArray(payload.members) || payload.members.length === 0) {
    throw new Error("没有可同步的成员数据");
  }

  const season = await prisma.season.findUnique({ where: { code: seasonCode } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const received = payload.members.length;

  // 1) 校验 + 去重（同一 playerIdInGame 保留最后一条）
  const validMap = new Map<number, MemberSyncInput>();
  let invalidCount = 0;
  for (const m of payload.members) {
    if (!isValidPlayerId(m.playerIdInGame)) {
      invalidCount += 1;
      continue;
    }
    validMap.set(m.playerIdInGame, m);
  }
  const validMembers = Array.from(validMap.values());
  const pushedIds = Array.from(validMap.keys());

  const now = new Date();
  const syncBatchId = makeBatchId(now);
  const weekNo = season.startAt ? weekNoOf(season.startAt, now) : 0;

  const result = await prisma.$transaction(async (tx) => {
    // 2) 统计新增 / 更新（先取该赛季已有成员）
    const existing = await tx.seasonMember.findMany({
      where: { seasonId: season.id },
      select: { playerIdInGame: true },
    });
    const existingIds = new Set(existing.map((e) => e.playerIdInGame));

    let created = 0;
    let updated = 0;

    // 3) 逐个 upsert（在盟）
    for (const m of validMembers) {
      const playerIdInGame = m.playerIdInGame as number;
      const data = {
        playerName: m.playerName ?? "",
        groupName: m.groupName ?? null,
        power: m.power ?? null,
        wu: m.wu ?? null,
        contributeTotal: m.contributeTotal ?? null,
        contributeWeek: m.contributeWeek ?? null,
        pos: m.pos ?? null,
        joinTime: m.joinTime ?? null,
        status: "active",
        lastSyncBatchId: syncBatchId,
        lastSyncedAt: now,
      };

      await tx.seasonMember.upsert({
        where: { seasonId_playerIdInGame: { seasonId: season.id, playerIdInGame } },
        create: { seasonId: season.id, playerIdInGame, ...data },
        update: data,
      });

      if (existingIds.has(playerIdInGame)) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    // 4) 标记在野：本次未推送、且当前在盟的成员
    //    注意：pushedIds 为空时跳过，否则 notIn:[] 会把全部在盟成员误标为在野
    let markedWild = 0;
    if (pushedIds.length > 0) {
      const wildResult = await tx.seasonMember.updateMany({
        where: {
          seasonId: season.id,
          status: "active",
          playerIdInGame: { notIn: pushedIds },
        },
        data: { status: "wild" },
      });
      markedWild = wildResult.count;
    }

    // 5) 写武勋快照（每个有效成员一条）
    if (validMembers.length > 0) {
      await tx.seasonMemberWuSnapshot.createMany({
        data: validMembers.map((m) => ({
          seasonId: season.id,
          syncBatchId,
          playerIdInGame: m.playerIdInGame as number,
          memberName: m.playerName ?? "",
          groupName: m.groupName ?? null,
          weekNo,
          wu: m.wu ?? 0,
          power: m.power ?? null,
          capturedAt: now,
        })),
      });
    }
    const snapshotCount = validMembers.length;

    // 6) 写同步日志
    await tx.syncRecord.create({
      data: {
        seasonId: season.id,
        operationType: "member_sync",
        syncedCount: validMembers.length,
        operatorRole,
        operatorAlliance: operatorAlliance || null,
        operatorServer: operatorServer || null,
        syncBatchId,
        createdCount: created,
        updatedCount: updated,
        markedWild,
        snapshotCount,
        invalidCount,
      },
    });

    return { created, updated, markedWild, snapshotCount };
  }, { timeout: 30000 });

  // 同步成功后，瘦身历史周快照（事务外、失败不影响同步结果）。
  // 规则：对所有 weekNo < 当前周 的历史周，每个 (成员, 周) 只保留最后一次快照，
  // 判定基准与读取端一致：capturedAt 最大，capturedAt 相同时取 id 最大。
  // 当前周(weekNo)的快照全部保留——本周可能还会继续同步，"最后一次"尚未确定。
  if (weekNo > 1) {
    try {
      await pruneOldWeekSnapshots(season.id, weekNo);
    } catch (e) {
      console.error("[member-sync] 清理历史周快照失败（已忽略，不影响同步）:", e);
    }
  }

  return {
    received,
    created: result.created,
    updated: result.updated,
    markedWild: result.markedWild,
    snapshotCount: result.snapshotCount,
    invalidCount,
    syncBatchId,
    seasonCode: season.code,
  };
}

// 删除指定赛季中所有 weekNo < currentWeekNo 历史周里「非每周最后一次」的快照。
async function pruneOldWeekSnapshots(seasonId: string, currentWeekNo: number) {
  // 取每个 (playerIdInGame, weekNo) 应保留的那条 id。
  // 用原生 SQL 的 DISTINCT ON 一次选出保留集，避免把全部快照拉进内存。
  const keepRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT ON ("playerIdInGame", "weekNo") "id"
    FROM "SeasonMemberWuSnapshot"
    WHERE "seasonId" = ${seasonId}
      AND "weekNo" >= 1
      AND "weekNo" < ${currentWeekNo}
    ORDER BY "playerIdInGame", "weekNo", "capturedAt" DESC, "id" DESC
  `;

  const keepIds = keepRows.map((r) => r.id);

  await prisma.seasonMemberWuSnapshot.deleteMany({
    where: {
      seasonId,
      weekNo: { gte: 1, lt: currentWeekNo },
      ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
    },
  });
}

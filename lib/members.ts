import { prisma } from "@/lib/prisma";

const statusRank: Record<string, number> = {
  active: 0,
  hidden: 1,
  wild: 2,
};

export async function listSeasonMembers(seasonCode: string) {
  const code = seasonCode.trim().toLowerCase();
  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({ where: { code } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const members = await prisma.seasonMember.findMany({
    where: { seasonId: season.id },
    select: {
      id: true,
      playerIdInGame: true,
      playerName: true,
      groupName: true,
      status: true,
      power: true,
      wu: true,
      contributeTotal: true,
      contributeWeek: true,
      pos: true,
      joinTime: true,
      lastSyncedAt: true,
    },
  });

  // 在盟优先、在野永远置底，同状态内按势力值降序
  members.sort((a, b) => {
    const rankA = statusRank[a.status] ?? 99;
    const rankB = statusRank[b.status] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (b.power ?? 0) - (a.power ?? 0);
  });

  return {
    season: { id: season.id, code: season.code, name: season.name },
    members,
  };
}

export type WeeklyWuMember = {
  playerIdInGame: number;
  playerName: string;
  groupName: string | null;
  status: string;
  weeks: Record<number, number>; // weekNo -> wu
  totalWu: number;
};

export type WeeklyWuResult = {
  season: { id: string; code: string; name: string };
  weekNos: number[]; // 升序，全部出现过的周序号（>=1）
  members: WeeklyWuMember[];
};

// 周武勋统计：每个成员每周取该周最后一次同步快照的 wu，按总武勋降序。
export async function listSeasonWeeklyWu(seasonCode: string): Promise<WeeklyWuResult> {
  const code = seasonCode.trim().toLowerCase();
  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({ where: { code } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  // 取该赛季全部快照（weekNo>=1，开服当周 weekNo=0 不计入周统计），
  // 按 capturedAt 升序，便于后面用「后写覆盖」取每周最后一次。
  const snapshots = await prisma.seasonMemberWuSnapshot.findMany({
    where: { seasonId: season.id, weekNo: { gte: 1 } },
    select: {
      playerIdInGame: true,
      memberName: true,
      groupName: true,
      weekNo: true,
      wu: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: "asc" },
  });

  // 当前成员表用于补充最新名字/分组/状态
  const currentMembers = await prisma.seasonMember.findMany({
    where: { seasonId: season.id },
    select: { playerIdInGame: true, playerName: true, groupName: true, status: true },
  });
  const currentMap = new Map(currentMembers.map((m) => [m.playerIdInGame, m]));

  const weekSet = new Set<number>();
  const memberMap = new Map<number, WeeklyWuMember>();

  for (const s of snapshots) {
    weekSet.add(s.weekNo);

    let member = memberMap.get(s.playerIdInGame);
    if (!member) {
      const cur = currentMap.get(s.playerIdInGame);
      member = {
        playerIdInGame: s.playerIdInGame,
        playerName: cur?.playerName ?? s.memberName,
        groupName: cur?.groupName ?? s.groupName,
        status: cur?.status ?? "wild",
        weeks: {},
        totalWu: 0,
      };
      memberMap.set(s.playerIdInGame, member);
    }
    // 升序遍历，同周后写覆盖 = 取该周最后一次同步
    member.weeks[s.weekNo] = s.wu;
  }

  const weekNos = Array.from(weekSet).sort((a, b) => a - b);

  const members = Array.from(memberMap.values());
  for (const m of members) {
    m.totalWu = weekNos.reduce((sum, w) => sum + (m.weeks[w] ?? 0), 0);
  }
  members.sort((a, b) => b.totalWu - a.totalWu);

  return {
    season: { id: season.id, code: season.code, name: season.name },
    weekNos,
    members,
  };
}

export type SiegeStatMember = {
  playerIdInGame: number;
  playerName: string;
  groupName: string | null;
  status: string;
  siegeCount: number;
};

export type SiegeStatResult = {
  season: { id: string; code: string; name: string };
  members: SiegeStatMember[];
};

// 攻城统计：每个成员的攻城记录条数（一条记录 = 参与一次攻城），按攻城数降序。
export async function listSeasonSiegeStats(seasonCode: string): Promise<SiegeStatResult> {
  const code = seasonCode.trim().toLowerCase();
  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({ where: { code } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  // 按玩家聚合攻城记录条数（唯一键 seasonId+localTaskId+playerIdInGame 保证一任务一条）
  const grouped = await prisma.seasonMemberSiegeRecord.groupBy({
    by: ["playerIdInGame"],
    where: { seasonId: season.id },
    _count: { _all: true },
  });

  // 取一条记录用于补充未在成员表中玩家的展示名
  const nameRows = await prisma.seasonMemberSiegeRecord.findMany({
    where: { seasonId: season.id },
    select: { playerIdInGame: true, memberName: true },
    distinct: ["playerIdInGame"],
  });
  const nameMap = new Map(nameRows.map((r) => [r.playerIdInGame, r.memberName]));

  const currentMembers = await prisma.seasonMember.findMany({
    where: { seasonId: season.id },
    select: { playerIdInGame: true, playerName: true, groupName: true, status: true },
  });
  const currentMap = new Map(currentMembers.map((m) => [m.playerIdInGame, m]));

  const members: SiegeStatMember[] = grouped.map((g) => {
    const cur = currentMap.get(g.playerIdInGame);
    return {
      playerIdInGame: g.playerIdInGame,
      playerName: cur?.playerName ?? nameMap.get(g.playerIdInGame) ?? "",
      groupName: cur?.groupName ?? null,
      status: cur?.status ?? "wild",
      siegeCount: g._count._all,
    };
  });

  members.sort((a, b) => b.siegeCount - a.siegeCount);

  return {
    season: { id: season.id, code: season.code, name: season.name },
    members,
  };
}

// ===== 赛季表现导出 =====

const NO_GROUP_KEYS = new Set(["", "__none__", "未分组"]);

export type ExportPerformanceRow = {
  playerIdInGame: number;
  playerName: string;
  groupName: string | null;
  totalWu: number;
  weeks: Record<number, number>; // weekNo -> wu（仅包含导出的周）
  siegeCount: number;
  siegeDetail: string; // 各攻城地点名拼接：洛阳_平原_平寿
};

export type ExportPerformanceResult = {
  season: { id: string; code: string; name: string };
  weekNos: number[]; // 实际导出的周序号，升序
  rows: ExportPerformanceRow[];
};

export type ExportPerformanceOptions = {
  groups: string[]; // 必选的分组名（空串 / __none__ / 未分组 表示未分组）
  playerIds?: number[]; // 额外单独添加的成员
  weeks?: number | null; // 导出前几周；为空或 <=0 表示全部
};

// 导出分组（+额外成员）的赛季表现：名字、总武勋、各周武勋、攻城数、攻城地点详情。
// 表格按总武勋降序排列。
export async function exportSeasonPerformance(
  seasonCode: string,
  options: ExportPerformanceOptions,
): Promise<ExportPerformanceResult> {
  const code = seasonCode.trim().toLowerCase();
  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({ where: { code } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const groups = options.groups ?? [];
  const extraIds = options.playerIds ?? [];
  if (groups.length === 0 && extraIds.length === 0) {
    throw new Error("请至少选择一个分组");
  }

  // 选中的分组集合：归一化未分组
  const wantUngrouped = groups.some((g) => NO_GROUP_KEYS.has(g));
  const wantGroups = new Set(groups.filter((g) => !NO_GROUP_KEYS.has(g)));

  const allMembers = await prisma.seasonMember.findMany({
    where: { seasonId: season.id },
    select: { playerIdInGame: true, playerName: true, groupName: true },
  });
  const memberMap = new Map(allMembers.map((m) => [m.playerIdInGame, m]));

  // 目标成员 = 命中所选分组的成员 ∪ 额外指定的成员
  const targetIds = new Set<number>();
  for (const m of allMembers) {
    const grouped = !!(m.groupName && m.groupName.trim());
    if ((grouped && wantGroups.has(m.groupName as string)) || (!grouped && wantUngrouped)) {
      targetIds.add(m.playerIdInGame);
    }
  }
  for (const id of extraIds) targetIds.add(id);

  if (targetIds.size === 0) {
    return { season: { id: season.id, code: season.code, name: season.name }, weekNos: [], rows: [] };
  }

  const ids = Array.from(targetIds);

  // 周武勋：每个成员每周取该周最后一次同步快照
  const snapshots = await prisma.seasonMemberWuSnapshot.findMany({
    where: { seasonId: season.id, weekNo: { gte: 1 }, playerIdInGame: { in: ids } },
    select: { playerIdInGame: true, memberName: true, groupName: true, weekNo: true, wu: true },
    orderBy: { capturedAt: "asc" },
  });

  const weekSet = new Set<number>();
  const weeksByPlayer = new Map<number, Record<number, number>>();
  const snapName = new Map<number, string>();
  const snapGroup = new Map<number, string | null>();
  for (const s of snapshots) {
    weekSet.add(s.weekNo);
    let w = weeksByPlayer.get(s.playerIdInGame);
    if (!w) {
      w = {};
      weeksByPlayer.set(s.playerIdInGame, w);
    }
    w[s.weekNo] = s.wu; // 升序后写覆盖 = 取该周最后一次
    snapName.set(s.playerIdInGame, s.memberName);
    snapGroup.set(s.playerIdInGame, s.groupName);
  }

  let weekNos = Array.from(weekSet).sort((a, b) => a - b);
  const limit = options.weeks ?? null;
  if (limit != null && limit > 0) {
    weekNos = weekNos.slice(0, limit);
  }

  // 攻城记录：按成员聚合条数与地点名
  const siegeRows = await prisma.seasonMemberSiegeRecord.findMany({
    where: { seasonId: season.id, playerIdInGame: { in: ids } },
    select: { playerIdInGame: true, memberName: true, targetName: true, finishedAt: true },
    orderBy: [{ finishedAt: "asc" }, { createdAt: "asc" }],
  });
  const siegeByPlayer = new Map<number, { count: number; names: string[] }>();
  for (const r of siegeRows) {
    let agg = siegeByPlayer.get(r.playerIdInGame);
    if (!agg) {
      agg = { count: 0, names: [] };
      siegeByPlayer.set(r.playerIdInGame, agg);
    }
    agg.count += 1;
    if (r.targetName && r.targetName.trim()) agg.names.push(r.targetName.trim());
    if (!snapName.has(r.playerIdInGame)) snapName.set(r.playerIdInGame, r.memberName);
  }

  const rows: ExportPerformanceRow[] = ids.map((id) => {
    const member = memberMap.get(id);
    const allWeeks = weeksByPlayer.get(id) ?? {};
    const weeks: Record<number, number> = {};
    let totalWu = 0;
    for (const w of weekNos) {
      const v = allWeeks[w] ?? 0;
      weeks[w] = v;
      totalWu += v;
    }
    const siege = siegeByPlayer.get(id);
    return {
      playerIdInGame: id,
      playerName: member?.playerName ?? snapName.get(id) ?? "",
      groupName: member?.groupName ?? snapGroup.get(id) ?? null,
      totalWu,
      weeks,
      siegeCount: siege?.count ?? 0,
      siegeDetail: (siege?.names ?? []).join("_"),
    };
  });

  rows.sort((a, b) => b.totalWu - a.totalWu);

  return {
    season: { id: season.id, code: season.code, name: season.name },
    weekNos,
    rows,
  };
}

export type MemberWeeklyWuRow = {
  weekNo: number;
  wu: number;
};

export type MemberSiegeRow = {
  id: string;
  localTaskId: number;
  taskName: string | null;
  targetName: string | null;
  targetPosition: string | null;
  finishedAt: string | null;
  mainCount: number;
  demolishCount: number;
  mainTimes: number;
  demolishTimes: number;
};

export type MemberWinRateRow = {
  id: string;
  hero1Id: number;
  hero2Id: number;
  hero3Id: number;
  hero1Level: number | null;
  hero2Level: number | null;
  hero3Level: number | null;
  hero1Star: number | null;
  hero2Star: number | null;
  hero3Star: number | null;
  totalStar: number | null;
  totalBattles: number;
  winCount: number;
  drawCount: number;
  lossCount: number;
  role: string | null;
};

export type SeasonMemberDetailResult = {
  season: { id: string; code: string; name: string };
  member: {
    playerIdInGame: number;
    playerName: string;
    groupName: string | null;
    status: string;
    power: number | null;
    wu: number | null;
    contributeTotal: number | null;
    contributeWeek: number | null;
    pos: number | null;
    joinTime: number | null;
    lastSyncedAt: string | null;
    exists: boolean; // 是否仍在赛季成员表中
  };
  weekly: {
    rows: MemberWeeklyWuRow[];
    totalWu: number;
  };
  siege: MemberSiegeRow[];
  winRates: MemberWinRateRow[];
};

// 成员详情：基础信息 + 周武勋（每周取最后一次快照）+ 攻城记录列表
export async function getSeasonMemberDetail(
  seasonCode: string,
  playerIdInGame: number,
): Promise<SeasonMemberDetailResult> {
  const code = seasonCode.trim().toLowerCase();
  if (!code) {
    throw new Error("赛季代号不能为空");
  }
  if (!Number.isInteger(playerIdInGame) || playerIdInGame <= 0) {
    throw new Error("成员 ID 无效");
  }

  const season = await prisma.season.findUnique({ where: { code } });
  if (!season) {
    throw new Error("目标赛季不存在");
  }

  const memberRow = await prisma.seasonMember.findUnique({
    where: { seasonId_playerIdInGame: { seasonId: season.id, playerIdInGame } },
    select: {
      playerIdInGame: true,
      playerName: true,
      groupName: true,
      status: true,
      power: true,
      wu: true,
      contributeTotal: true,
      contributeWeek: true,
      pos: true,
      joinTime: true,
      lastSyncedAt: true,
    },
  });

  // 周武勋：取每周最后一次快照
  const snapshots = await prisma.seasonMemberWuSnapshot.findMany({
    where: { seasonId: season.id, playerIdInGame, weekNo: { gte: 1 } },
    select: { weekNo: true, wu: true, memberName: true, groupName: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  });
  const weekMap = new Map<number, number>();
  let fallbackName = "";
  let fallbackGroup: string | null = null;
  for (const s of snapshots) {
    weekMap.set(s.weekNo, s.wu); // 升序后写覆盖 = 取该周最后一次
    fallbackName = s.memberName;
    fallbackGroup = s.groupName;
  }
  const weeklyRows: MemberWeeklyWuRow[] = Array.from(weekMap.entries())
    .map(([weekNo, wu]) => ({ weekNo, wu }))
    .sort((a, b) => a.weekNo - b.weekNo);
  const totalWu = weeklyRows.reduce((sum, r) => sum + r.wu, 0);

  // 攻城记录
  const siegeRows = await prisma.seasonMemberSiegeRecord.findMany({
    where: { seasonId: season.id, playerIdInGame },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      localTaskId: true,
      taskName: true,
      targetName: true,
      targetPosition: true,
      finishedAt: true,
      mainCount: true,
      demolishCount: true,
      mainTimes: true,
      demolishTimes: true,
      memberName: true,
    },
  });

  const siegeFallbackName = siegeRows[0]?.memberName ?? "";

  const member = {
    playerIdInGame,
    playerName: memberRow?.playerName ?? fallbackName ?? siegeFallbackName ?? "",
    groupName: memberRow?.groupName ?? fallbackGroup ?? null,
    status: memberRow?.status ?? "wild",
    power: memberRow?.power ?? null,
    wu: memberRow?.wu ?? null,
    contributeTotal: memberRow?.contributeTotal ?? null,
    contributeWeek: memberRow?.contributeWeek ?? null,
    pos: memberRow?.pos ?? null,
    joinTime: memberRow?.joinTime ?? null,
    lastSyncedAt: memberRow?.lastSyncedAt ? memberRow.lastSyncedAt.toISOString() : null,
    exists: !!memberRow,
  };

  // 队伍胜率：按玩家名匹配（战报数据无 playerId，赛季内不考虑改名）
  let winRates: MemberWinRateRow[] = [];
  if (member.playerName) {
    const wrRows = await prisma.seasonTeamWinRate.findMany({
      where: { seasonId: season.id, playerName: member.playerName },
      orderBy: [{ totalBattles: "desc" }],
      select: {
        id: true,
        hero1Id: true,
        hero2Id: true,
        hero3Id: true,
        hero1Level: true,
        hero2Level: true,
        hero3Level: true,
        hero1Star: true,
        hero2Star: true,
        hero3Star: true,
        totalStar: true,
        totalBattles: true,
        winCount: true,
        drawCount: true,
        lossCount: true,
        role: true,
      },
    });
    winRates = wrRows;
  }

  return {
    season: { id: season.id, code: season.code, name: season.name },
    member,
    weekly: { rows: weeklyRows, totalWu },
    siege: siegeRows.map((r) => ({
      id: r.id,
      localTaskId: r.localTaskId,
      taskName: r.taskName,
      targetName: r.targetName,
      targetPosition: r.targetPosition,
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      mainCount: r.mainCount,
      demolishCount: r.demolishCount,
      mainTimes: r.mainTimes,
      demolishTimes: r.demolishTimes,
    })),
    winRates,
  };
}

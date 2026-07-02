import { prisma } from "@/lib/prisma";

export type TeamPlayerSummary = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  isFriendly: boolean;
  teamCount: number;
  totalStarSum: number;
  latestSnapshotTime: Date | null;
};

export type TeamPlayerSummaryListResult = {
  items: TeamPlayerSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type TeamPlayerDetail = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  isFriendly: boolean;
  teams: Array<{
    id: string;
    role: string;
    isFriendly: boolean;
    idu: string | null;
    battleId: number | null;
    snapshotTime: Date | null;
    totalStar: number | null;
    hero1Id: number;
    hero2Id: number;
    hero3Id: number;
    hero1Level: number | null;
    hero2Level: number | null;
    hero3Level: number | null;
    hero1Star: number | null;
    hero2Star: number | null;
    hero3Star: number | null;
    allSkillInfo: string | null;
    gearInfo: string | null;
    heroType: string | null;
  }>;
};

export async function listTeamPlayerSummaries(input?: {
  seasonId?: string;
  playerName?: string;
  unionName?: string;
  isFriendly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<TeamPlayerSummaryListResult> {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.max(1, input?.pageSize ?? 10);
  const playerKeyword = input?.playerName?.trim();
  const unionKeyword = input?.unionName?.trim();

  const grouped = await prisma.seasonTeamSnapshot.groupBy({
    by: ["seasonId", "playerName", "unionName", "isFriendly"],
    where: {
      ...(input?.seasonId ? { seasonId: input.seasonId } : {}),
      ...(input?.isFriendly === undefined ? {} : { isFriendly: input.isFriendly }),
      ...(playerKeyword
        ? {
            playerName: {
              contains: playerKeyword,
              mode: "insensitive",
            },
          }
        : {}),
      ...(unionKeyword
        ? {
            unionName: {
              contains: unionKeyword,
              mode: "insensitive",
            },
          }
        : {}),
    },
    _count: {
      _all: true,
    },
    _sum: {
      totalStar: true,
    },
    _max: {
      snapshotTime: true,
    },
  });

  if (!grouped.length) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    };
  }

  const seasonIds = [...new Set(grouped.map((item) => item.seasonId))];
  const seasons = await prisma.season.findMany({
    where: {
      id: {
        in: seasonIds,
      },
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  const seasonMap = new Map(seasons.map((season) => [season.id, season]));

  const items = grouped
    .map((item) => {
      const season = seasonMap.get(item.seasonId);
      if (!season) return null;

      return {
        seasonId: item.seasonId,
        seasonName: season.name,
        seasonCode: season.code,
        playerName: item.playerName,
        unionName: item.unionName,
        isFriendly: item.isFriendly,
        teamCount: item._count._all,
        totalStarSum: item._sum.totalStar ?? 0,
        latestSnapshotTime: item._max.snapshotTime,
      } satisfies TeamPlayerSummary;
    })
    .filter((item): item is TeamPlayerSummary => item !== null)
    .sort((a, b) => {
      if (b.teamCount !== a.teamCount) {
        return b.teamCount - a.teamCount;
      }

      const ta = a.latestSnapshotTime ? new Date(a.latestSnapshotTime).getTime() : 0;
      const tb = b.latestSnapshotTime ? new Date(b.latestSnapshotTime).getTime() : 0;
      return tb - ta;
    });

  const total = items.length;
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    total,
    page,
    pageSize,
  };
}

export async function getTeamPlayerDetail(input: {
  seasonId: string;
  playerName: string;
  unionName?: string;
  isFriendly?: boolean;
}): Promise<TeamPlayerDetail> {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!season) {
    throw new Error("赛季不存在");
  }

  const teams = await prisma.seasonTeamSnapshot.findMany({
    where: {
      seasonId: input.seasonId,
      playerName: input.playerName,
      ...(input.unionName ? { unionName: input.unionName } : {}),
      ...(input.isFriendly === undefined ? {} : { isFriendly: input.isFriendly }),
    },
    orderBy: [{ snapshotTime: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      role: true,
      isFriendly: true,
      idu: true,
      battleId: true,
      snapshotTime: true,
      totalStar: true,
      hero1Id: true,
      hero2Id: true,
      hero3Id: true,
      hero1Level: true,
      hero2Level: true,
      hero3Level: true,
      hero1Star: true,
      hero2Star: true,
      hero3Star: true,
      allSkillInfo: true,
      gearInfo: true,
      heroType: true,
    },
  });

  return {
    seasonId: season.id,
    seasonName: season.name,
    seasonCode: season.code,
    playerName: input.playerName,
    unionName: input.unionName ?? null,
    isFriendly: input.isFriendly ?? false,
    teams,
  };
}

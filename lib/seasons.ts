import { prisma } from "@/lib/prisma";

export type SeasonStatus = "active" | "archived";

export type CreateSeasonInput = {
  name: string;
  code: string;
  startAt: string;
};

export type ArchiveSeasonInput = {
  code: string;
  endAt: string;
};

export type DeleteSeasonInput = {
  code: string;
};

const seasonListOrder = [{ status: "asc" as const }, { startAt: "desc" as const }, { createdAt: "desc" as const }];

function normalizeCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, "-");
}

export function validateCreateSeasonInput(input: CreateSeasonInput) {
  const name = input.name.trim();
  const code = normalizeCode(input.code);
  const startAt = new Date(input.startAt);

  if (!name) {
    throw new Error("赛季名不能为空");
  }

  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  if (!/^[a-z0-9-]+$/.test(code)) {
    throw new Error("赛季代号只允许小写字母、数字和短横线");
  }

  if (Number.isNaN(startAt.getTime())) {
    throw new Error("开始日期不能为空");
  }

  return {
    name,
    code,
    status: "active" as const,
    startAt,
    endAt: null,
    remark: null,
  };
}

export async function listSeasons() {
  return prisma.season.findMany({
    orderBy: seasonListOrder,
  });
}

export async function listActiveSeasons() {
  return prisma.season.findMany({
    where: { status: "active" },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getMobileTeamSeason() {
  const boundSeason = await prisma.season.findFirst({
    where: { isMobileTeamDefault: true },
    orderBy: seasonListOrder,
  });

  if (boundSeason) {
    return boundSeason;
  }

  return prisma.season.findFirst({
    orderBy: seasonListOrder,
  });
}

export async function createSeason(input: CreateSeasonInput) {
  const data = validateCreateSeasonInput(input);

  return prisma.season.create({
    data,
  });
}

export async function archiveSeason(input: ArchiveSeasonInput) {
  const code = normalizeCode(input.code);
  const endAt = new Date(input.endAt);

  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  if (Number.isNaN(endAt.getTime())) {
    throw new Error("结束日期不能为空");
  }

  const season = await prisma.season.findUnique({
    where: { code },
  });

  if (!season) {
    throw new Error("赛季不存在");
  }

  if (season.status === "archived") {
    throw new Error("该赛季已经归档");
  }

  if (season.startAt && endAt < season.startAt) {
    throw new Error("结束日期不能早于开始日期");
  }

  return prisma.season.update({
    where: { code },
    data: {
      status: "archived",
      endAt,
    },
  });
}

export async function bindMobileTeamSeason(input: { code: string }) {
  const code = normalizeCode(input.code);

  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({
    where: { code },
  });

  if (!season) {
    throw new Error("赛季不存在");
  }

  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: {
        isMobileTeamDefault: true,
        NOT: {
          id: season.id,
        },
      },
      data: {
        isMobileTeamDefault: false,
      },
    });

    if (!season.isMobileTeamDefault) {
      await tx.season.update({
        where: { id: season.id },
        data: {
          isMobileTeamDefault: true,
        },
      });
    }
  });

  return prisma.season.findUniqueOrThrow({
    where: { id: season.id },
  });
}

export async function deleteSeason(input: DeleteSeasonInput) {
  const code = normalizeCode(input.code);

  if (!code) {
    throw new Error("赛季代号不能为空");
  }

  const season = await prisma.season.findUnique({
    where: { code },
  });

  if (!season) {
    throw new Error("赛季不存在");
  }

  if (season.isMobileTeamDefault) {
    throw new Error("当前赛季已绑定移动端，请先切换到其他赛季后再删除");
  }

  return prisma.season.delete({
    where: { code },
  });
}

import { herocfg, skillcfg } from "@/app/cfg";
import type { TeamPlayerDetail } from "@/lib/team-query";

type HeroConfig = {
  name: string;
};

type SkillConfig = {
  name: string;
};

type TeamHeroSkill = {
  id: string;
  level: number;
};

type ParsedSkillGroup = {
  index: number;
  skills: TeamHeroSkill[];
};

export type MobileTeamHeroDetail = {
  slotLabel: string;
  heroName: string;
  level: number | null;
  star: number | null;
  secondSkillName: string | null;
  secondSkillLevel: number | null;
  thirdSkillName: string | null;
  thirdSkillLevel: number | null;
};

export type MobileTeamDetailItem = {
  id: string;
  snapshotTime: Date | null;
  totalStar: number | null;
  heroes: MobileTeamHeroDetail[];
};

export type MobileTeamPlayerDetail = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  teams: MobileTeamDetailItem[];
};

const heroMap = JSON.parse(herocfg) as Record<string, HeroConfig>;
const skillMap = JSON.parse(skillcfg) as Record<string, SkillConfig>;

function resolveHeroId(id: number) {
  return id >= 130000 ? id - 30000 : id;
}

function getHeroName(id: number) {
  return heroMap[String(resolveHeroId(id))]?.name ?? `未知(${id})`;
}

function getSkillName(id: string) {
  return skillMap[String(id)]?.name ?? `未知(${id})`;
}

function normalizeSkill(skill: TeamHeroSkill | undefined) {
  if (!skill || !skill.id || skill.id === "0") {
    return {
      name: null,
      level: null,
    };
  }

  return {
    name: getSkillName(skill.id),
    level: skill.level > 0 ? skill.level : null,
  };
}

function parseSkillInfo(str: string | null, role: string) {
  if (!str) {
    return [];
  }

  const parsed = String(str)
    .split(";")
    .filter((item) => item.trim() !== "")
    .map((group) => {
      const parts = group.split(",");

      return {
        index: Number.parseInt(parts[0] ?? "0", 10),
        skills: [
          { id: parts[1] ?? "", level: Number.parseInt(parts[2] ?? "0", 10) || 0 },
          { id: parts[3] ?? "", level: Number.parseInt(parts[4] ?? "0", 10) || 0 },
          { id: parts[5] ?? "", level: Number.parseInt(parts[6] ?? "0", 10) || 0 },
        ],
      } satisfies ParsedSkillGroup;
    });

  let filtered =
    role === "attack"
      ? parsed.filter((group) => group.index >= 1 && group.index <= 3)
      : parsed.filter((group) => group.index >= 4 && group.index <= 6);

  if (role !== "attack") {
    filtered = filtered.reverse();
  }

  return filtered;
}

function buildTeamHeroes(team: TeamPlayerDetail["teams"][number]): MobileTeamHeroDetail[] {
  const skillGroups = parseSkillInfo(team.allSkillInfo, team.role);
  const heroSlots = [
    {
      slotLabel: "大营",
      heroName: getHeroName(team.hero1Id),
      level: team.hero1Level,
      star: team.hero1Star,
      skills: skillGroups[0]?.skills ?? [],
    },
    {
      slotLabel: "中军",
      heroName: getHeroName(team.hero2Id),
      level: team.hero2Level,
      star: team.hero2Star,
      skills: skillGroups[1]?.skills ?? [],
    },
    {
      slotLabel: "前锋",
      heroName: getHeroName(team.hero3Id),
      level: team.hero3Level,
      star: team.hero3Star,
      skills: skillGroups[2]?.skills ?? [],
    },
  ];

  return heroSlots.map((slot) => {
    const secondSkill = normalizeSkill(slot.skills[1]);
    const thirdSkill = normalizeSkill(slot.skills[2]);

    return {
      slotLabel: slot.slotLabel,
      heroName: slot.heroName,
      level: slot.level,
      star: slot.star,
      secondSkillName: secondSkill.name,
      secondSkillLevel: secondSkill.level,
      thirdSkillName: thirdSkill.name,
      thirdSkillLevel: thirdSkill.level,
    };
  });
}

export function buildMobileTeamPlayerDetail(detail: TeamPlayerDetail): MobileTeamPlayerDetail {
  return {
    seasonId: detail.seasonId,
    seasonName: detail.seasonName,
    seasonCode: detail.seasonCode,
    playerName: detail.playerName,
    unionName: detail.unionName,
    teams: detail.teams.map((team) => ({
      id: team.id,
      snapshotTime: team.snapshotTime,
      totalStar: team.totalStar,
      heroes: buildTeamHeroes(team),
    })),
  };
}

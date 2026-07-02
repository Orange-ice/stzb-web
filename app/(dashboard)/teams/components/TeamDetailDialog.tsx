"use client";

import { StarFilled, StarOutlined } from "@ant-design/icons";
import { Card, Empty, Modal, Skeleton, Space, Tag, Typography } from "antd";

import { gear_cfg, gear_feature_cfg, herocfg, skillcfg } from '@/app/cfg';

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
    snapshotTime: Date | string | null;
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

type HeroSlot = {
  label: string;
  heroId: number;
  level: number | null;
  star: number | null;
  skills: Array<{ id: string; level: number }>;
  gear: {
    gearId: string;
    level: number;
    entryId: string;
  } | null;
};

const heroMap = JSON.parse(herocfg) as Record<string, { name: string; country?: string; type?: string }>;
const skillMap = JSON.parse(skillcfg) as Record<string, { name: string; type?: string; zfQuality?: string }>;
const gearFeatureMap = gear_feature_cfg as Record<string, { name: string }>;
const gearMap = Object.fromEntries(
  gear_cfg.map((item) => [
    String(item.gear_id),
    {
      name: item.name,
    },
  ]),
) as Record<string, { name: string }>;

export function formatDateTime(date: Date | string | null) {
  if (!date) return "未设置";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function resolveHeroId(id: number) {
  return id >= 130000 ? id - 30000 : id;
}

export function formatSideLabel(isFriendly: boolean) {
  return isFriendly ? "我方" : "敌方";
}

function formatTeamRole(role: string) {
  if (role === "attack") {
    return "进攻";
  }

  if (role === "defense" || role === "defence" || role === "guard") {
    return "防守";
  }

  return role || "未标记";
}

function getHeroMeta(id: number) {
  return heroMap[String(resolveHeroId(id))] ?? null;
}

function getHeroName(id: number) {
  return getHeroMeta(id)?.name ?? `未知(${id})`;
}

function getSkillName(id: string) {
  return skillMap[String(id)]?.name ?? `未知(${id})`;
}

function getGearName(id: string) {
  return gearMap[String(id)]?.name ?? `未知(${id})`;
}

function getGearEntryName(id: string) {
  return gearFeatureMap[String(id)]?.name ?? `未知(${id})`;
}

function getFilledStarCount(star: number | null) {
  if (!star || star <= 0) return 0;

  return Math.max(0, Math.min(5, Math.floor(star)));
}

function parseSkillInfo(str: string | null, role: string) {
  if (!str) return [];

  const groups = String(str).split(";").filter((item) => item.trim() !== "");
  const parsed = groups.map((group) => {
    const parts = group.split(",");
    return {
      index: Number.parseInt(parts[0] ?? "0", 10),
      skills: [
        { id: parts[1] ?? "", level: Number.parseInt(parts[2] ?? "0", 10) || 0 },
        { id: parts[3] ?? "", level: Number.parseInt(parts[4] ?? "0", 10) || 0 },
        { id: parts[5] ?? "", level: Number.parseInt(parts[6] ?? "0", 10) || 0 },
      ],
    };
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

function parseGearInfo(str: string | null, role: string) {
  if (!str) return [];

  const parsed = String(str)
    .split(";")
    .filter((item) => item.trim() !== "")
    .map((group) => {
      const parts = group.split(",");
      return {
        gearId: parts[0] ?? "",
        level: Number.parseInt(parts[1] ?? "0", 10) || 0,
        entryId: parts[2] ?? "",
      };
    })
    .filter((item) => item.gearId && item.gearId !== "0");

  return role === "attack" ? parsed : parsed.reverse();
}

function buildHeroSlots(team: TeamPlayerDetail["teams"][number]): HeroSlot[] {
  const skillGroups = parseSkillInfo(team.allSkillInfo, team.role);
  const gearGroups = parseGearInfo(team.gearInfo, team.role);

  return [
    {
      label: "大营",
      heroId: team.hero1Id,
      level: team.hero1Level,
      star: team.hero1Star,
      skills: skillGroups[0]?.skills ?? [],
      gear: gearGroups[0] ?? null,
    },
    {
      label: "中军",
      heroId: team.hero2Id,
      level: team.hero2Level,
      star: team.hero2Star,
      skills: skillGroups[1]?.skills ?? [],
      gear: gearGroups[1] ?? null,
    },
    {
      label: "前锋",
      heroId: team.hero3Id,
      level: team.hero3Level,
      star: team.hero3Star,
      skills: skillGroups[2]?.skills ?? [],
      gear: gearGroups[2] ?? null,
    },
  ];
}

export function TeamDetailDialog({
                                   open,
                                   onClose,
                                   detail,
                                   loading,
                                 }: {
  open: boolean;
  onClose: () => void;
  detail: TeamPlayerDetail | null;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1120}
      destroyOnHidden
      title={
        <div className="pr-8">
          <div className="text-lg font-semibold text-slate-900">
            {detail ? `${detail.playerName} 的队伍详情` : "队伍详情"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {detail ? `${detail.seasonName} / ${detail.seasonCode}` : "正在加载赛季信息..."}
            {detail?.unionName ? ` / ${detail.unionName}` : ""}
            {detail ? ` / ${formatSideLabel(detail.isFriendly)}` : ""}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-4">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : detail?.teams.length ? (
        <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
          {detail.teams.map((team, index) => {
            const heroSlots = buildHeroSlots(team);

            return (
              <Card
                key={team.id}
                size="small"
                title={
                  <Space wrap size={[8, 8]}>
                    <span className="font-semibold text-slate-900">队伍 {index + 1}</span>
                    <Tag color={team.role === "attack" ? "volcano" : "blue"}>{formatTeamRole(team.role)}</Tag>
                    {team.heroType ? <Tag>{team.heroType}</Tag> : null}
                  </Space>
                }
                extra={
                  <Space wrap size={[8, 8]}>
                    <Tag color="gold" className="px-2 py-0 text-xs leading-5">
                      总红度 {team.totalStar ?? "-"}
                    </Tag>
                    <Typography.Text type="secondary" className="text-xs">
                      {formatDateTime(team.snapshotTime)}
                    </Typography.Text>
                  </Space>
                }
                styles={{
                  header: { minHeight: 44, padding: "0 12px" },
                  body: { padding: 12 },
                }}
                className="shadow-sm"
              >
                <div className="grid gap-2 md:grid-cols-3">
                  {heroSlots.map((slot) => {
                    const heroMeta = getHeroMeta(slot.heroId);
                    const validSkills = slot.skills.filter((skill) => skill.id && skill.id !== "0");
                    const visibleSkills = validSkills.slice(1);

                    return (
                      <Card
                        key={`${team.id}-${slot.label}`}
                        size="small"
                        className="h-full bg-slate-50/70"
                        styles={{ body: { height: "100%", padding: 10 } }}
                      >
                        <Space orientation="vertical" size={8} className="w-full">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {slot.label}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
                                <span className="text-xs font-medium text-slate-500">Lv.{slot.level ?? "-"}</span>
                                <span>{getHeroName(slot.heroId)}</span>
                                <span className="flex items-center gap-0.5 text-[11px] leading-none">
                                  {Array.from({ length: 5 }, (_, index) =>
                                    index < getFilledStarCount(slot.star) ? (
                                      <StarFilled key={`${slot.label}-star-${index}`} className="text-amber-400" />
                                    ) : (
                                      <StarOutlined key={`${slot.label}-star-${index}`} className="text-slate-300" />
                                    ),
                                  )}
                                </span>
                              </div>
                            </div>
                            <Space wrap size={[4, 4]}>
                              {heroMeta?.country ? <Tag className="m-0 text-xs">{heroMeta.country}</Tag> : null}
                              {heroMeta?.type ? (
                                <Tag color="cyan" className="m-0 text-xs">
                                  {heroMeta.type}
                                </Tag>
                              ) : null}
                            </Space>
                          </div>

                          <div className="space-y-1">
                            <Typography.Text strong className="text-xs text-slate-700">
                              技能
                            </Typography.Text>
                            {visibleSkills.length ? (
                              <Space wrap size={[6, 6]} className="flex">
                                {visibleSkills.map((skill, skillIndex) => (
                                  <Tag
                                    key={`${slot.label}-${skill.id}-${skillIndex}`}
                                    color="processing"
                                    className="m-0 px-2 py-0 text-xs leading-5"
                                  >
                                    {getSkillName(skill.id)}
                                    {skill.level ? ` Lv.${skill.level}` : ""}
                                  </Tag>
                                ))}
                              </Space>
                            ) : (
                              <Typography.Text type="secondary" className="block text-xs">
                                -
                              </Typography.Text>
                            )}
                          </div>

                          <div className="space-y-1">
                            {slot.gear ? (
                              <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                                <span>{`Lv.${slot.gear.level}`}</span>
                                <Tag>{getGearName(slot.gear.gearId)}</Tag>
                                <Tag color="yellow">{getGearEntryName(slot.gear.entryId || "-")}</Tag>
                              </div>
                            ) : (
                              <Typography.Text type="secondary" className="block text-xs">
                                -
                              </Typography.Text>
                            )}
                          </div>
                        </Space>
                      </Card>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到队伍详情" className="py-10" />
      )}
    </Modal>
  );
}

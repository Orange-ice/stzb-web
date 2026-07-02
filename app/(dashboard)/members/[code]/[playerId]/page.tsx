"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Alert, Card, Descriptions, Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import { herocfg } from "@/app/cfg";

const heroMap = JSON.parse(herocfg) as Record<string, { name: string; type?: string }>;
function resolveHeroId(id: number) {
  return id >= 130000 ? id - 30000 : id;
}
function getHeroName(id: number | null | undefined) {
  if (!id) return "-";
  return heroMap[String(resolveHeroId(id))]?.name ?? `未知(${id})`;
}

type MemberWeeklyWuRow = { weekNo: number; wu: number };

type MemberWinRateRow = {
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

type MemberSiegeRow = {
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

type MemberDetail = {
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
    exists: boolean;
  };
  weekly: { rows: MemberWeeklyWuRow[]; totalWu: number };
  siege: MemberSiegeRow[];
  winRates: MemberWinRateRow[];
};

function rate(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function formatNumber(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDateTime(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function statusTag(status: string) {
  if (status === "wild") return <Tag color="orange">在野</Tag>;
  if (status === "hidden") return <Tag>隐藏</Tag>;
  return <Tag color="green">在盟</Tag>;
}

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ code: string; playerId: string }>;
}) {
  const { code, playerId } = use(params);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(
        `/api/seasons/${encodeURIComponent(code)}/members/${encodeURIComponent(playerId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "获取成员详情失败");
      }
      setDetail(payload.data as MemberDetail);
    } catch (error) {
      setDetail(null);
      setErrorMessage(error instanceof Error ? error.message : "获取成员详情失败");
    } finally {
      setLoading(false);
    }
  }, [code, playerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 周武勋统计：单行表格，表头为「名称、总武勋、第N周…」
  type WeeklyRowData = { key: string; playerName: string; totalWu: number; weeks: Record<number, number> };
  const weeklyWeekNos = (detail?.weekly.rows ?? []).map((r) => r.weekNo);
  const weeklyRowData: WeeklyRowData[] = detail
    ? [
        {
          key: "wu",
          playerName: detail.member.playerName || "-",
          totalWu: detail.weekly.totalWu,
          weeks: Object.fromEntries(detail.weekly.rows.map((r) => [r.weekNo, r.wu])),
        },
      ]
    : [];
  const weeklyColumns: ColumnsType<WeeklyRowData> = [
    { title: "名称", dataIndex: "playerName", key: "playerName", width: 160, fixed: "left" },
    {
      title: "总武勋",
      dataIndex: "totalWu",
      key: "totalWu",
      width: 130,
      align: "right",
      fixed: "left",
      render: (v: number) => <span className="font-semibold text-slate-900">{formatNumber(v)}</span>,
    },
    ...weeklyWeekNos.map((w) => ({
      title: `第${w}周`,
      key: `week-${w}`,
      width: 110,
      align: "right" as const,
      render: (_: unknown, record: WeeklyRowData) =>
        record.weeks[w] == null ? <span className="text-slate-300">-</span> : formatNumber(record.weeks[w]),
    })),
  ];

  const siegeColumns: ColumnsType<MemberSiegeRow> = [
    {
      title: "名字",
      key: "playerName",
      width: 140,
      render: () => detail?.member.playerName || "-",
    },
    {
      title: "分组",
      key: "groupName",
      width: 120,
      render: () => detail?.member.groupName || <span className="text-slate-400">未分组</span>,
    },
    {
      title: "地点",
      dataIndex: "targetPosition",
      key: "targetPosition",
      width: 120,
      render: (v: string | null) => v || "-",
    },
    {
      title: "地点名称",
      dataIndex: "targetName",
      key: "targetName",
      width: 160,
      render: (v: string | null) => v || "-",
    },
    { title: "主力数", dataIndex: "mainCount", key: "mainCount", width: 90, align: "right" },
    { title: "拆迁数", dataIndex: "demolishCount", key: "demolishCount", width: 90, align: "right" },
    { title: "主力次数", dataIndex: "mainTimes", key: "mainTimes", width: 100, align: "right" },
    { title: "拆迁次数", dataIndex: "demolishTimes", key: "demolishTimes", width: 100, align: "right" },
    {
      title: "完结时间",
      dataIndex: "finishedAt",
      key: "finishedAt",
      width: 170,
      render: (v: string | null) => formatDateTime(v),
    },
  ];

  const winRateColumns: ColumnsType<MemberWinRateRow> = [
    { title: "大营", key: "hero1", width: 110, render: (_, r) => getHeroName(r.hero1Id) },
    { title: "中军", key: "hero2", width: 110, render: (_, r) => getHeroName(r.hero2Id) },
    { title: "前锋", key: "hero3", width: 110, render: (_, r) => getHeroName(r.hero3Id) },
    {
      title: "等级",
      key: "levels",
      width: 110,
      align: "center",
      render: (_, r) => `${r.hero1Level ?? "-"}_${r.hero2Level ?? "-"}_${r.hero3Level ?? "-"}`,
    },
    {
      title: "红度",
      key: "stars",
      width: 100,
      align: "center",
      render: (_, r) => `${r.hero1Star ?? 0}_${r.hero2Star ?? 0}_${r.hero3Star ?? 0}`,
    },
    {
      title: "战报数",
      dataIndex: "totalBattles",
      key: "totalBattles",
      width: 90,
      align: "right",
      sorter: (a, b) => a.totalBattles - b.totalBattles,
      defaultSortOrder: "descend",
    },
    {
      title: "胜率",
      key: "winRate",
      width: 90,
      align: "right",
      sorter: (a, b) => a.winCount / (a.totalBattles || 1) - b.winCount / (b.totalBattles || 1),
      render: (_, r) => (
        <span className="font-semibold text-emerald-600">{rate(r.winCount, r.totalBattles)}</span>
      ),
    },
    {
      title: "平率",
      key: "drawRate",
      width: 90,
      align: "right",
      render: (_, r) => rate(r.drawCount, r.totalBattles),
    },
    {
      title: "败率",
      key: "lossRate",
      width: 90,
      align: "right",
      render: (_, r) => <span className="text-rose-600">{rate(r.lossCount, r.totalBattles)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/members" className="text-sm text-sky-600 hover:underline">
          ← 返回成员管理
        </Link>
      </div>

      {errorMessage ? (
        <Alert type="error" showIcon message="加载失败" description={errorMessage} />
      ) : loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !detail ? (
        <Empty description="未找到成员数据" />
      ) : (
        <>
          <div className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,#082f49_0%,#0f4c81_48%,#38bdf8_100%)] px-6 py-5 text-sky-50 shadow-[0_18px_40px_-24px_rgba(14,116,144,0.95)]">
            <div className="text-2xl font-bold tracking-[0.12em]">现形吧！摸鱼崽</div>
          </div>

          <Card>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-900">{detail.member.playerName || "-"}</span>
              {statusTag(detail.member.status)}
              <span className="text-sm text-slate-500">{detail.season.name}</span>
            </div>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label="分组">{detail.member.groupName || "未分组"}</Descriptions.Item>
              <Descriptions.Item label="势力">{formatNumber(detail.member.power)}</Descriptions.Item>
              <Descriptions.Item label="当前本周武勋">{formatNumber(detail.member.wu)}</Descriptions.Item>
              <Descriptions.Item label="总贡献">{formatNumber(detail.member.contributeTotal)}</Descriptions.Item>
              <Descriptions.Item label="周贡献">{formatNumber(detail.member.contributeWeek)}</Descriptions.Item>
              <Descriptions.Item label="最近同步">{formatDateTime(detail.member.lastSyncedAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={`周武勋统计（总武勋 ${formatNumber(detail.weekly.totalWu)}）`}>
            {detail.weekly.rows.length === 0 ? (
              <Empty description="暂无周武勋快照" />
            ) : (
              <Table<WeeklyRowData>
                rowKey="key"
                columns={weeklyColumns}
                dataSource={weeklyRowData}
                pagination={false}
                size="middle"
                scroll={{ x: 290 + weeklyWeekNos.length * 110 }}
              />
            )}
          </Card>

          <Card title={`攻城记录（共 ${detail.siege.length} 条）`}>
            {detail.siege.length === 0 ? (
              <Empty description="暂无攻城记录" />
            ) : (
              <Table<MemberSiegeRow>
                rowKey="id"
                columns={siegeColumns}
                dataSource={detail.siege}
                pagination={false}
                size="middle"
                scroll={{ x: 1010 }}
              />
            )}
          </Card>

          <Card title={`队伍胜率（共 ${detail.winRates.length} 支队伍）`}>
            {detail.winRates.length === 0 ? (
              <Empty description="暂无胜率数据，请在桌面端「队伍胜率」页同步" />
            ) : (
              <Table<MemberWinRateRow>
                rowKey="id"
                columns={winRateColumns}
                dataSource={detail.winRates}
                pagination={false}
                size="middle"
                scroll={{ x: 910 }}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

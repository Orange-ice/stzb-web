"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button, Card, Empty, Input, Pagination, Segmented, Select, Space, Table, Tag, Typography, type TableProps } from "antd";

import { TeamDetailDialog, formatDateTime, formatSideLabel, type TeamPlayerDetail } from "./components/TeamDetailDialog";

type TeamPlayerSummary = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  isFriendly: boolean;
  teamCount: number;
  latestSnapshotTime: Date | string | null;
};

type SeasonRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  startAt: Date | string | null;
  endAt: Date | string | null;
  createdAt: Date | string;
  remark: string | null;
};

type TeamFilters = {
  seasonId: string;
  playerName: string;
  unionName: string;
  side: "enemy" | "ally";
};

function TeamsFilterBar({
  filters,
  seasons,
  pending,
  onPushQuery,
}: {
  filters: TeamFilters;
  seasons: SeasonRecord[];
  pending: boolean;
  onPushQuery: (next: {
    seasonId?: string;
    playerName?: string;
    unionName?: string;
    side?: "enemy" | "ally";
    page?: number;
  }) => void;
}) {
  const [playerKeyword, setPlayerKeyword] = useState(filters.playerName);
  const [unionKeyword, setUnionKeyword] = useState(filters.unionName);

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_220px_220px]">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">赛季</div>
        <Select
          value={filters.seasonId}
          disabled={pending}
          onChange={(value) =>
            onPushQuery({
              seasonId: value,
              playerName: playerKeyword,
              unionName: unionKeyword,
              page: 1,
            })
          }
          options={seasons.map((season) => ({
            value: season.id,
            label: `${season.name} (${season.code})`,
          }))}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">玩家名</div>
        <Input.Search
          allowClear
          enterButton="查询"
          value={playerKeyword}
          disabled={pending}
          onChange={(event) => setPlayerKeyword(event.target.value)}
          onSearch={(value) =>
            onPushQuery({
              playerName: value,
              unionName: unionKeyword,
              page: 1,
            })
          }
          placeholder="输入玩家名称"
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">敌我方</div>
        <Segmented
          block
          value={filters.side}
          disabled={pending}
          onChange={(value) =>
            onPushQuery({
              side: value as "enemy" | "ally",
              playerName: playerKeyword,
              unionName: unionKeyword,
              page: 1,
            })
          }
          options={[
            { label: "敌方", value: "enemy" },
            { label: "我方", value: "ally" },
          ]}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">同盟</div>
        <Input.Search
          allowClear
          enterButton="筛选"
          value={unionKeyword}
          disabled={pending}
          onChange={(event) => setUnionKeyword(event.target.value)}
          onSearch={(value) =>
            onPushQuery({
              playerName: playerKeyword,
              unionName: value,
              page: 1,
            })
          }
          placeholder="输入同盟名称"
        />
      </div>
    </div>
  );
}

export function TeamsPageClient({
  teamPlayers,
  seasons,
  total,
  page,
  pageSize,
  filters,
}: {
  teamPlayers: TeamPlayerSummary[];
  seasons: SeasonRecord[];
  total: number;
  page: number;
  pageSize: number;
  filters: TeamFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [teamDetailOpen, setTeamDetailOpen] = useState(false);
  const [teamDetailLoading, setTeamDetailLoading] = useState(false);
  const [teamDetail, setTeamDetail] = useState<TeamPlayerDetail | null>(null);
  const [tableScrollY, setTableScrollY] = useState(320);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const displayPage = Math.min(page, totalPages);
  const selectedSeason = seasons.find((season) => season.id === filters.seasonId) ?? null;

  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) {
      return;
    }

    const updateScrollY = () => {
      const header =
        (wrap.querySelector(".ant-table-header") as HTMLElement | null) ??
        (wrap.querySelector(".ant-table-thead") as HTMLElement | null);
      const headerHeight = header?.getBoundingClientRect().height ?? 55;
      const nextHeight = Math.max(Math.floor(wrap.getBoundingClientRect().height - headerHeight - 2), 200);
      setTableScrollY(nextHeight);
    };

    updateScrollY();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateScrollY();
          });

    observer?.observe(wrap);
    window.addEventListener("resize", updateScrollY);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollY);
    };
  }, [teamPlayers.length, total, page, isPending]);

  function pushQuery(next: {
    seasonId?: string;
    playerName?: string;
    unionName?: string;
    side?: "enemy" | "ally";
    page?: number;
  }) {
    const params = new URLSearchParams();
    const seasonId = next.seasonId ?? filters.seasonId;
    const playerName = next.playerName ?? filters.playerName;
    const unionName = next.unionName ?? filters.unionName;
    const side = next.side ?? filters.side;
    const targetPage = next.page ?? 1;

    if (seasonId) {
      params.set("seasonId", seasonId);
    }
    if (playerName.trim()) {
      params.set("playerName", playerName.trim());
    }
    if (unionName.trim()) {
      params.set("unionName", unionName.trim());
    }
    params.set("side", side);
    params.set("page", String(Math.max(1, targetPage)));

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const openTeamDetail = async (player: TeamPlayerSummary) => {
    setTeamDetailOpen(true);
    setTeamDetailLoading(true);
    setTeamDetail(null);

    try {
      const params = new URLSearchParams({
        seasonId: player.seasonId,
        playerName: player.playerName,
      });

      if (player.unionName) {
        params.set("unionName", player.unionName);
      }

      params.set("side", player.isFriendly ? "ally" : "enemy");

      const response = await fetch(`/api/team-players/detail?${params.toString()}`);
      const payload = (await response.json()) as { success: boolean; data?: TeamPlayerDetail };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error("获取队伍详情失败");
      }

      setTeamDetail(payload.data);
    } catch {
      setTeamDetail({
        seasonId: player.seasonId,
        seasonName: player.seasonName,
        seasonCode: player.seasonCode,
        playerName: player.playerName,
        unionName: player.unionName,
        isFriendly: player.isFriendly,
        teams: [],
      });
    } finally {
      setTeamDetailLoading(false);
    }
  };

  const columns: TableProps<TeamPlayerSummary>["columns"] = [
    {
      title: "玩家",
      key: "player",
      width: 280,
      render: (_, player) => (
        <div className="space-y-2">
          <Space wrap size={[8, 8]}>
            <Typography.Text strong className="text-[15px] text-slate-900">
              {player.playerName}
            </Typography.Text>
            <Tag color={player.isFriendly ? "green" : "volcano"}>{formatSideLabel(player.isFriendly)}</Tag>
          </Space>
          <div className="text-sm text-slate-500">{player.unionName || "未记录同盟"}</div>
        </div>
      ),
    },
    {
      title: "赛季",
      key: "season",
      width: 220,
      render: (_, player) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text className="font-medium text-slate-800">{player.seasonName}</Typography.Text>
          <Typography.Text type="secondary">{player.seasonCode}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "队伍数",
      dataIndex: "teamCount",
      key: "teamCount",
      width: 120,
      render: (value: number) => (
        <Tag color="blue" className="rounded-full px-3 py-1 text-sm">
          {value}
        </Tag>
      ),
    },
    {
      title: "最近更新时间",
      dataIndex: "latestSnapshotTime",
      key: "latestSnapshotTime",
      width: 220,
      render: (value: Date | string | null) => (
        <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      align: "right",
      render: (_, player) => (
        <Button type="link" onClick={() => void openTeamDetail(player)} className="px-0">
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-600">Team Query</div>
          </div>

          <Space wrap size={[8, 8]}>
            {selectedSeason ? (
              <Tag color="processing" className="rounded-full px-3 py-1">
                {selectedSeason.name} ({selectedSeason.code})
              </Tag>
            ) : null}
            <Tag
              color={filters.side === "ally" ? "green" : "volcano"}
              className="rounded-full px-3 py-1"
            >
              {filters.side === "ally" ? "我方视角" : "敌方视角"}
            </Tag>
            <Tag className="rounded-full px-3 py-1">共 {total} 条</Tag>
          </Space>
        </div>

        <Card
          styles={{
            body: {
              padding: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            },
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-[0_20px_60px_-36px_rgba(15,23,42,0.28)]"
        >
          <div className="shrink-0 border-b border-slate-200/80 px-6 py-5">
            <TeamsFilterBar
              key={`${filters.seasonId}:${filters.playerName}:${filters.unionName}:${filters.side}`}
              filters={filters}
              seasons={seasons}
              pending={isPending}
              onPushQuery={pushQuery}
            />
          </div>

          <div ref={tableWrapRef} className="min-h-0 flex-1 overflow-hidden">
            <Table<TeamPlayerSummary>
              rowKey={(player) =>
                `${player.seasonId}:${player.playerName}:${player.unionName ?? ""}:${player.isFriendly ? "ally" : "enemy"}`
              }
              columns={columns}
              dataSource={teamPlayers}
              pagination={false}
              loading={isPending}
              size="middle"
              rowHoverable={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div className="space-y-1">
                        <div className="text-base font-medium text-slate-700">没有匹配的人员</div>
                        <div className="text-sm text-slate-500">调整筛选条件，或先从桌面端同步队伍数据。</div>
                      </div>
                    }
                  />
                ),
              }}
              scroll={{ x: 920, y: tableScrollY }}
              className="[&_.ant-spin-container]:flex [&_.ant-spin-container]:h-full [&_.ant-spin-container]:flex-col [&_.ant-spin-nested-loading]:h-full [&_.ant-table]:flex [&_.ant-table]:h-full [&_.ant-table]:flex-col [&_.ant-table]:bg-transparent [&_.ant-table-body]:flex-1 [&_.ant-table-cell]:align-top [&_.ant-table-container]:flex [&_.ant-table-container]:flex-1 [&_.ant-table-container]:flex-col [&_.ant-table-content]:overflow-x-auto [&_.ant-table-tbody>tr>td]:border-b-slate-100/90 [&_.ant-table-thead>tr>th]:border-b-slate-200 [&_.ant-table-thead>tr>th]:bg-slate-50/80 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-[0.18em]"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-6 py-4">
            <Typography.Text type="secondary">
              共 {total} 条记录，第 {displayPage} / {totalPages} 页
              {isPending ? "，加载中..." : ""}
            </Typography.Text>

            <Pagination
              current={displayPage}
              total={total}
              pageSize={pageSize}
              showSizeChanger={false}
              onChange={(nextPage) =>
                pushQuery({
                  page: nextPage,
                })
              }
              disabled={isPending || total === 0}
              size="small"
            />
          </div>
        </Card>
      </div>

      <TeamDetailDialog
        open={teamDetailOpen}
        onClose={() => {
          setTeamDetailOpen(false);
          setTeamDetail(null);
        }}
        detail={teamDetail}
        loading={teamDetailLoading}
      />
    </>
  );
}

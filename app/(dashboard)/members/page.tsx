"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Alert, Button, Card, Empty, message, Modal, Segmented, Select, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import * as XLSXStyle from "xlsx-js-style";

type SeasonOption = {
  id: string;
  code: string;
  name: string;
};

type ViewMode = "current" | "weekly" | "siege";

type WeeklyWuMember = {
  playerIdInGame: number;
  playerName: string;
  groupName: string | null;
  status: string;
  weeks: Record<number, number>;
  totalWu: number;
};

type SiegeStatMember = {
  playerIdInGame: number;
  playerName: string;
  groupName: string | null;
  status: string;
  siegeCount: number;
};

type SeasonMemberItem = {
  id: string;
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
};

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

function formatTimestamp(value: number | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value * 1000));
}

function formatNumber(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("zh-CN").format(value);
}

// 坐标解码：末 4 位为 y，其余为 x（与桌面端 splitwid 一致）
function formatPos(pos: number | null) {
  if (pos == null) return "-";
  const str = String(pos);
  if (str.length <= 4) return `0,${Number(str)}`;
  const x = str.slice(0, -4);
  const y = Number(str.slice(-4));
  return `${x},${y}`;
}

function statusTag(status: string) {
  if (status === "wild") return <Tag color="orange">在野</Tag>;
  if (status === "hidden") return <Tag>隐藏</Tag>;
  return <Tag color="green">在盟</Tag>;
}

// 分组筛选：未分组成员用该哨兵值表示
const NO_GROUP = "__none__";
function groupKey(name: string | null) {
  return name && name.trim() ? name : NO_GROUP;
}

// 文件名去除非法字符
function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "赛季表现";
}

// 估算单元格显示宽度（中文等全角字符按 2 计），用于列宽自适应
function cellWidth(text: string) {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 255 ? 2 : 1;
  return w;
}

type PerformanceExport = {
  weekNos: number[];
  rows: {
    playerName: string;
    totalWu: number;
    weeks: Record<number, number>;
    siegeCount: number;
    siegeDetail: string;
  }[];
};

// 生成并下载赛季表现 xlsx：表头加粗居中、列宽自适应
function downloadPerformanceXlsx(data: PerformanceExport, groupLabel: string) {
  const header = [
    "名字",
    "总武勋",
    ...data.weekNos.map((w) => `第${w}周`),
    "总攻城数",
    "攻城详情",
  ];
  const aoa = [
    header,
    ...data.rows.map((r) => [
      r.playerName,
      r.totalWu,
      ...data.weekNos.map((w) => r.weeks[w] ?? 0),
      r.siegeCount,
      r.siegeDetail,
    ]),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  // 列宽自适应（不折叠），并对宽列设上限
  ws["!cols"] = header.map((_, c) => {
    const max = aoa.reduce((m, row) => Math.max(m, cellWidth(String(row[c] ?? ""))), 0);
    return { wch: Math.min(Math.max(max + 2, 8), 60) };
  });

  // 表头样式：加粗、居中
  const range = XLSXStyle.utils.decode_range(ws["!ref"] as string);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, "赛季表现");
  XLSXStyle.writeFile(wb, `${sanitizeFileName(`${groupLabel}_赛季表现`)}.xlsx`);
}

export default function MembersPage() {
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [seasonCode, setSeasonCode] = useState<string>("");
  const [view, setView] = useState<ViewMode>("current");
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [members, setMembers] = useState<SeasonMemberItem[]>([]);
  const [weeklyMembers, setWeeklyMembers] = useState<WeeklyWuMember[]>([]);
  const [weekNos, setWeekNos] = useState<number[]>([]);
  const [siegeMembers, setSiegeMembers] = useState<SiegeStatMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ===== 导出赛季表现 =====
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportGroups, setExportGroups] = useState<string[]>([]);
  const [exportPlayerIds, setExportPlayerIds] = useState<number[]>([]);
  const [exportWeeks, setExportWeeks] = useState<number>(0); // 0 = 全部
  const [exportMetaLoading, setExportMetaLoading] = useState(false);
  const [exportMeta, setExportMeta] = useState<{
    members: { playerIdInGame: number; playerName: string; groupName: string | null }[];
    weekNos: number[];
  } | null>(null);

  const loadSeasons = useCallback(async () => {
    try {
      const response = await fetch("/api/seasons", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "获取赛季列表失败");
      }
      const list = (payload.data || []) as SeasonOption[];
      setSeasons(list);
      if (list.length > 0) {
        setSeasonCode((prev) => prev || list[0].code);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "获取赛季列表失败");
    }
  }, []);

  const loadMembers = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/seasons/${encodeURIComponent(code)}/members`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "获取赛季成员失败");
      }
      setMembers((payload.data?.members || []) as SeasonMemberItem[]);
    } catch (error) {
      setMembers([]);
      setErrorMessage(error instanceof Error ? error.message : "获取赛季成员失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeeklyWu = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/seasons/${encodeURIComponent(code)}/members/weekly-wu`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "获取周武勋统计失败");
      }
      setWeeklyMembers((payload.data?.members || []) as WeeklyWuMember[]);
      setWeekNos((payload.data?.weekNos || []) as number[]);
    } catch (error) {
      setWeeklyMembers([]);
      setWeekNos([]);
      setErrorMessage(error instanceof Error ? error.message : "获取周武勋统计失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSiegeStats = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/seasons/${encodeURIComponent(code)}/members/siege-stats`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "获取攻城统计失败");
      }
      setSiegeMembers((payload.data?.members || []) as SiegeStatMember[]);
    } catch (error) {
      setSiegeMembers([]);
      setErrorMessage(error instanceof Error ? error.message : "获取攻城统计失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 导出弹框的选项数据：当前赛季完整名单（分组/成员）+ 周序号（决定可选周数）
  const loadExportMeta = useCallback(async (code: string) => {
    if (!code) return;
    setExportMetaLoading(true);
    try {
      const [memberRes, weeklyRes] = await Promise.all([
        fetch(`/api/seasons/${encodeURIComponent(code)}/members`, { cache: "no-store" }),
        fetch(`/api/seasons/${encodeURIComponent(code)}/members/weekly-wu`, { cache: "no-store" }),
      ]);
      const memberPayload = await memberRes.json();
      const weeklyPayload = await weeklyRes.json();
      setExportMeta({
        members: (memberPayload.data?.members || []) as {
          playerIdInGame: number;
          playerName: string;
          groupName: string | null;
        }[],
        weekNos: (weeklyPayload.data?.weekNos || []) as number[],
      });
    } catch {
      setExportMeta({ members: [], weekNos: [] });
    } finally {
      setExportMetaLoading(false);
    }
  }, []);

  const openExport = () => {
    setExportGroups(groupFilter);
    setExportPlayerIds([]);
    setExportWeeks(0);
    setExportOpen(true);
    void loadExportMeta(seasonCode);
  };

  const doExport = async () => {
    if (exportGroups.length === 0) {
      message.warning("请至少选择一个分组");
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(
        `/api/seasons/${encodeURIComponent(seasonCode)}/members/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groups: exportGroups,
            playerIds: exportPlayerIds,
            weeks: exportWeeks > 0 ? exportWeeks : null,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "导出失败");
      }
      const data = payload.data as {
        weekNos: number[];
        rows: {
          playerName: string;
          totalWu: number;
          weeks: Record<number, number>;
          siegeCount: number;
          siegeDetail: string;
        }[];
      };
      const groupLabel = exportGroups
        .map((g) => (g === NO_GROUP ? "未分组" : g))
        .join("_");
      downloadPerformanceXlsx(data, groupLabel);
      message.success(`已导出 ${data.rows.length} 名成员`);
      setExportOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    void loadSeasons();
  }, [loadSeasons]);

  useEffect(() => {
    if (!seasonCode) return;
    if (view === "current") {
      void loadMembers(seasonCode);
    } else if (view === "weekly") {
      void loadWeeklyWu(seasonCode);
    } else {
      void loadSiegeStats(seasonCode);
    }
  }, [seasonCode, view, loadMembers, loadWeeklyWu, loadSiegeStats]);

  const nameLink = (playerIdInGame: number, name: string, status: string) => (
    <div className="flex items-center gap-2">
      <Link
        href={`/members/${encodeURIComponent(seasonCode)}/${playerIdInGame}`}
        className="font-medium text-sky-600 hover:underline"
      >
        {name || "-"}
      </Link>
      {statusTag(status)}
    </div>
  );

  const columns: ColumnsType<SeasonMemberItem> = [
    {
      title: "名字",
      dataIndex: "playerName",
      key: "playerName",
      width: 160,
      render: (value: string, record) => nameLink(record.playerIdInGame, value, record.status),
    },
    {
      title: "分组",
      dataIndex: "groupName",
      key: "groupName",
      width: 120,
      render: (value: string | null) => value || <span className="text-slate-400">未分组</span>,
    },
    {
      title: "势力",
      dataIndex: "power",
      key: "power",
      width: 110,
      align: "right",
      render: formatNumber,
    },
    {
      title: "本周武勋",
      dataIndex: "wu",
      key: "wu",
      width: 120,
      align: "right",
      render: formatNumber,
    },
    {
      title: "总贡献",
      dataIndex: "contributeTotal",
      key: "contributeTotal",
      width: 120,
      align: "right",
      render: formatNumber,
    },
    {
      title: "周贡献",
      dataIndex: "contributeWeek",
      key: "contributeWeek",
      width: 110,
      align: "right",
      render: formatNumber,
    },
    {
      title: "坐标",
      dataIndex: "pos",
      key: "pos",
      width: 110,
      render: (value: number | null) => formatPos(value),
    },
    {
      title: "进盟时间",
      dataIndex: "joinTime",
      key: "joinTime",
      width: 130,
      render: (value: number | null) => formatTimestamp(value),
    },
    {
      title: "最近同步",
      dataIndex: "lastSyncedAt",
      key: "lastSyncedAt",
      width: 160,
      render: (value: string | null) => formatDateTime(value),
    },
  ];

  const weeklyColumns: ColumnsType<WeeklyWuMember> = [
    {
      title: "名字",
      dataIndex: "playerName",
      key: "playerName",
      width: 160,
      fixed: "left",
      render: (value: string, record) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{value || "-"}</span>
          {statusTag(record.status)}
        </div>
      ),
    },
    {
      title: "分组",
      dataIndex: "groupName",
      key: "groupName",
      width: 120,
      fixed: "left",
      render: (value: string | null) => value || <span className="text-slate-400">未分组</span>,
    },
    {
      title: "总武勋",
      dataIndex: "totalWu",
      key: "totalWu",
      width: 130,
      align: "right",
      fixed: "left",
      render: (value: number) => <span className="font-semibold text-slate-900">{formatNumber(value)}</span>,
    },
    ...weekNos.map((w) => ({
      title: `第${w}周`,
      key: `week-${w}`,
      width: 110,
      align: "right" as const,
      render: (_: unknown, record: WeeklyWuMember) =>
        record.weeks[w] == null ? <span className="text-slate-300">-</span> : formatNumber(record.weeks[w]),
    })),
  ];

  const siegeColumns: ColumnsType<SiegeStatMember> = [
    {
      title: "名字",
      dataIndex: "playerName",
      key: "playerName",
      width: 200,
      render: (value: string, record) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{value || "-"}</span>
          {statusTag(record.status)}
        </div>
      ),
    },
    {
      title: "分组",
      dataIndex: "groupName",
      key: "groupName",
      width: 160,
      render: (value: string | null) => value || <span className="text-slate-400">未分组</span>,
    },
    {
      title: "攻城数",
      dataIndex: "siegeCount",
      key: "siegeCount",
      width: 140,
      align: "right",
      render: (value: number) => <span className="font-semibold text-slate-900">{formatNumber(value)}</span>,
    },
  ];

  const isWeekly = view === "weekly";
  const isSiege = view === "siege";

  // 当前视图的数据源，用于推导分组选项
  const activeGroupSource: { groupName: string | null }[] = isWeekly
    ? weeklyMembers
    : isSiege
      ? siegeMembers
      : members;
  const groupOptions = Array.from(new Set(activeGroupSource.map((m) => groupKey(m.groupName))))
    .sort((a, b) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b, "zh-CN")))
    .map((k) => ({ value: k, label: k === NO_GROUP ? "未分组" : k }));

  const matchGroup = (name: string | null) =>
    groupFilter.length === 0 || groupFilter.includes(groupKey(name));

  const filteredMembers = members.filter((m) => matchGroup(m.groupName));
  const filteredWeeklyMembers = weeklyMembers.filter((m) => matchGroup(m.groupName));
  const filteredSiegeMembers = siegeMembers.filter((m) => matchGroup(m.groupName));

  const currentCount = isWeekly
    ? filteredWeeklyMembers.length
    : isSiege
      ? filteredSiegeMembers.length
      : filteredMembers.length;
  const isEmpty = isWeekly
    ? filteredWeeklyMembers.length === 0
    : isSiege
      ? filteredSiegeMembers.length === 0
      : filteredMembers.length === 0;

  // 导出弹框选项：分组（必选）、额外成员、可选周数
  const exportGroupOptions = Array.from(
    new Set((exportMeta?.members ?? []).map((m) => groupKey(m.groupName))),
  )
    .sort((a, b) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b, "zh-CN")))
    .map((k) => ({ value: k, label: k === NO_GROUP ? "未分组" : k }));
  const exportMemberOptions = (exportMeta?.members ?? [])
    .slice()
    .sort((a, b) => a.playerName.localeCompare(b.playerName, "zh-CN"))
    .map((m) => ({
      value: m.playerIdInGame,
      label: `${m.playerName}${m.groupName ? `（${m.groupName}）` : "（未分组）"}`,
    }));
  const exportMaxWeek = exportMeta?.weekNos.length ?? 0;
  const exportWeekOptions = [
    { value: 0, label: "全部周" },
    ...Array.from({ length: exportMaxWeek }, (_, i) => ({ value: i + 1, label: `前${i + 1}周` })),
  ];

  return (
    <div className="space-y-5">
      <Card
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 px-6 py-5">
          <span className="text-sm text-slate-500">赛季</span>
          <Select
            value={seasonCode || undefined}
            onChange={(value) => {
              setSeasonCode(value);
              setGroupFilter([]);
            }}
            placeholder="选择赛季"
            style={{ minWidth: 240 }}
            options={seasons.map((s) => ({ label: `${s.name} (${s.code})`, value: s.code }))}
          />
          <Segmented<ViewMode>
            value={view}
            onChange={(value) => setView(value)}
            options={[
              { label: "当前", value: "current" },
              { label: "周武勋统计", value: "weekly" },
              { label: "攻城统计", value: "siege" },
            ]}
          />
          <Select
            mode="multiple"
            allowClear
            value={groupFilter}
            onChange={(value) => setGroupFilter(value)}
            placeholder="分组筛选"
            style={{ minWidth: 200, maxWidth: 360 }}
            options={groupOptions}
            maxTagCount="responsive"
          />
          <span className="ml-auto text-sm text-slate-500">
            共 {currentCount} 名成员
          </span>
          <Button type="primary" onClick={openExport} disabled={!seasonCode}>
            导出
          </Button>
        </div>

        {errorMessage ? (
          <div className="px-6 py-6">
            <Alert type="error" showIcon message="加载失败" description={errorMessage} />
          </div>
        ) : loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : isEmpty ? (
          <div className="px-6 py-14">
            <Empty
              description={
                isWeekly
                  ? "该赛季暂无周武勋快照数据"
                  : isSiege
                    ? "该赛季暂无攻城记录数据"
                    : "该赛季暂无成员数据"
              }
            />
          </div>
        ) : isWeekly ? (
          <Table<WeeklyWuMember>
            rowKey="playerIdInGame"
            columns={weeklyColumns}
            dataSource={filteredWeeklyMembers}
            pagination={false}
            size="middle"
            scroll={{ x: 410 + weekNos.length * 110 }}
          />
        ) : isSiege ? (
          <Table<SiegeStatMember>
            rowKey="playerIdInGame"
            columns={siegeColumns}
            dataSource={filteredSiegeMembers}
            pagination={false}
            size="middle"
            scroll={{ x: 500 }}
          />
        ) : (
          <Table<SeasonMemberItem>
            rowKey="id"
            columns={columns}
            dataSource={filteredMembers}
            pagination={false}
            size="middle"
            scroll={{ x: 1080 }}
          />
        )}
      </Card>

      <Modal
        open={exportOpen}
        title="导出赛季表现"
        onCancel={() => setExportOpen(false)}
        onOk={doExport}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ loading: exporting, disabled: exportGroups.length === 0 }}
        closable={!exporting}
        destroyOnHidden
      >
        <Spin spinning={exportMetaLoading}>
          <div className="flex flex-col gap-4 py-1">
            <div>
              <div className="mb-1.5 text-sm text-slate-600">
                <span className="mr-1 text-rose-500">*</span>分组（必选，可多选）
              </div>
              <Select
                mode="multiple"
                allowClear
                value={exportGroups}
                onChange={(value) => setExportGroups(value)}
                placeholder="选择要导出的分组"
                style={{ width: "100%" }}
                options={exportGroupOptions}
                maxTagCount="responsive"
              />
            </div>
            <div>
              <div className="mb-1.5 text-sm text-slate-600">额外添加成员（可多选）</div>
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                value={exportPlayerIds}
                onChange={(value) => setExportPlayerIds(value)}
                placeholder="可单独再选择成员一并导出"
                style={{ width: "100%" }}
                options={exportMemberOptions}
                maxTagCount="responsive"
              />
            </div>
            <div>
              <div className="mb-1.5 text-sm text-slate-600">导出周数</div>
              <Select
                value={exportWeeks}
                onChange={(value) => setExportWeeks(value)}
                style={{ width: "100%" }}
                options={exportWeekOptions}
              />
            </div>
          </div>
        </Spin>
      </Modal>
    </div>
  );
}

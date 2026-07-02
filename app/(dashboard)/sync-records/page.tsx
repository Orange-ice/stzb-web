"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

type SyncRecordItem = {
  id: string;
  syncTime: string;
  operationType: string;
  syncedCount: number;
  operatorRole: string;
  operatorAlliance: string | null;
  operatorServer: string | null;
  season: {
    id: string;
    name: string;
    code: string;
  };
};

type SyncRecordsApiPayload = {
  success: boolean;
  message?: string;
  data?: SyncRecordItem[];
};

function formatDateTime(date: string | Date | null) {
  if (!date) return "未设置";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function operationTone(operationType: string) {
  const normalized = operationType.trim().toLowerCase();

  if (normalized.includes("sync")) {
    return "cyan";
  }

  if (normalized.includes("import")) {
    return "geekblue";
  }

  return "blue";
}

function operationLabel(operationType: string) {
  const normalized = operationType.trim().toLowerCase();

  if (normalized === "team_query_sync") {
    return "队伍同步";
  }

  return operationType || "未命名操作";
}

export default function SyncRecordsPage() {
  const [records, setRecords] = useState<SyncRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/sync-records", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as SyncRecordsApiPayload;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "获取同步记录失败");
      }

      setRecords(payload.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "获取同步记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const columns: ColumnsType<SyncRecordItem> = [
    {
      title: "赛季 / 动作",
      key: "season",
      width: 300,
      render: (_, record) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-slate-900">{record.season.name}</span>
            <Tag color={operationTone(record.operationType)} className="!mr-0 rounded-full px-2.5 py-0.5">
              {operationLabel(record.operationType)}
            </Tag>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-1 font-medium tracking-[0.08em] text-slate-600">
              {record.season.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "同步简报",
      key: "summary",
      width: 220,
      render: (_, record) => (
        <div className="space-y-2">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {formatCount(record.syncedCount)}
          </div>
        </div>
      ),
    },
    {
      title: "执行信息",
      key: "operator",
      width: 300,
      render: (_, record) => (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">操作角色</div>
            <div className="mt-1 text-sm font-medium text-slate-800">{record.operatorRole}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-100/80 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">同盟</div>
              <div className="mt-1 truncate text-sm text-slate-700">{record.operatorAlliance || "-"}</div>
            </div>
            <div className="rounded-2xl bg-sky-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-sky-500">服务器</div>
              <div className="mt-1 truncate text-sm text-slate-700">{record.operatorServer || "-"}</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "同步时间",
      dataIndex: "syncTime",
      key: "syncTime",
      width: 220,
      render: (value: string | null) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-800">{formatDateTime(value)}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">

      <Card
        styles={{
          body: {
            padding: 0,
          },
        }}
      >
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Button onClick={() => void loadRecords()} disabled={loading}>
              刷新
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="px-6 py-6">
            <Alert
              type="error"
              showIcon
              message="同步记录加载失败"
              description={errorMessage}
              action={
                <Button size="small" onClick={() => void loadRecords()}>
                  重试
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : records.length === 0 ? (
          <div className="px-6 py-14">
            <Empty
              description={
                <div className="space-y-1">
                  <div className="text-base font-medium text-slate-700">还没有同步记录</div>
                  <div className="text-sm text-slate-500">桌面端完成一次队伍同步后，会在这里留下记录。</div>
                </div>
              }
            />
          </div>
        ) : (
          <Table<SyncRecordItem>
            rowKey="id"
            columns={columns}
            dataSource={records}
            pagination={false}
            size="middle"
            rowHoverable={false}
            className="[&_.ant-table]:bg-transparent [&_.ant-table-cell]:align-top [&_.ant-table-thead>tr>th]:border-b-slate-200 [&_.ant-table-thead>tr>th]:bg-slate-50/80 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-[0.18em] [&_.ant-table-tbody>tr>td]:border-b-slate-100/90"
            scroll={{ x: 1040 }}
          />
        )}
      </Card>
    </div>
  );
}

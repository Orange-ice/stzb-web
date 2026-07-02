"use client";

import { useState } from "react";

import {
  deleteSeasonAction,
  type SeasonActionState,
} from "@/app/actions";
import SeasonsAdd from "@/app/(dashboard)/seasons/components/SeasonsAdd";
import SeasonsArchive from "@/app/(dashboard)/seasons/components/SeasonsArchive";
import { Button, Card, message, Popconfirm, Table, type TableProps, Tag } from "antd";

export type SeasonRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  isMobileTeamDefault: boolean;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
  remark: string | null;
};

const initialState: SeasonActionState = {
  success: false,
  message: "",
};

function formatDate(date: Date | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function statusLabel(status: string) {
  return status === "archived" ? "已结束" : "进行中";
}

export function SeasonsPageClient({ seasons }: { seasons: SeasonRecord[] }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<SeasonRecord | null>(null);
  const [mobileBoundSeasonId, setMobileBoundSeasonId] = useState(
    seasons.find((season) => season.isMobileTeamDefault)?.id ?? "",
  );

  const columns: TableProps<SeasonRecord>["columns"] = [
    {
      title: "赛季",
      dataIndex: "name",
      key: "name",
      render: (_, season) => {
        const isMobileBound = season.id === mobileBoundSeasonId;

        return (
          <div className="flex items-center gap-x-2">
            <span className="text-[16px] font-bold">{season.name}</span>
            <span className="text-[12px] text-gray-400">{season.code}</span>
            <Tag color={season.status === "archived" ? "" : "blue"}>{statusLabel(season.status)}</Tag>
            {isMobileBound ? <Tag color="green">已绑定移动端</Tag> : ""}
          </div>
        );
      },
    },
    {
      title: "开始日期",
      dataIndex: "startAt",
      key: "startAt",
      render: (_, season) => <span>{formatDate(season.createdAt)}</span>,
    },
    {
      title: "结束日期",
      dataIndex: "endAt",
      key: "endAt",
      render: (_, season) => <span>{formatDate(season.endAt)}</span>,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (_, season) => <span>{season.createdAt.toLocaleString()}</span>,
    },
    {
      title: "操作",
      dataIndex: "",
      key: "operation",
      render: (_, season) => {
        const isMobileBound = season.id === mobileBoundSeasonId;
        const isEnded = season.status === 'archived';

        return (
          <div>
            <Button
              color="primary"
              variant="text"
              disabled={isMobileBound}
              onClick={() => {
                void bindMobileSeason(season);
              }}
            >
              绑定移动端
            </Button>
            <Button color="primary" variant="text" disabled={isEnded} onClick={() => setArchiveTarget(season)}>
              归档
            </Button>

            <Popconfirm
              title="删除赛季"
              description={
                <div className="max-w-72 text-sm leading-6 text-slate-600">
                  删除赛季会连带删除该赛季的成员、队伍快照和同步记录，此操作不可撤销。
                </div>
              }
              onConfirm={() => handleDelete(season)}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              placement="left"
            >
              <Button color="danger" variant="text">
                删除
              </Button>
            </Popconfirm>

          </div>
        );
      },
    },
  ];

  async function handleDelete(season: SeasonRecord) {
    const formData = new FormData();
    formData.set("code", season.code);

    const result = await deleteSeasonAction(initialState, formData);

    if (result.success) {
      messageApi.success(result.message);
      return;
    }

    messageApi.error(result.message);
  }

  const bindMobileSeason = async (season: SeasonRecord) => {
    if (season.id === mobileBoundSeasonId) {
      return;
    }

    try {
      const response = await fetch(`/api/seasons/${encodeURIComponent(season.code)}/mobile-team-binding`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: SeasonRecord;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "更新移动端默认赛季失败");
      }

      setMobileBoundSeasonId(payload.data.id);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新移动端默认赛季失败");
    }
  };

  return (
    <>
      {contextHolder}
      <Card>
        <div className="mb-4">
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            创建赛季
          </Button>
        </div>
        <Table columns={columns} dataSource={seasons} rowKey="id" pagination={false} size="small" rowHoverable={false} />
      </Card>

      {createOpen ? <SeasonsAdd open={createOpen} onClose={() => setCreateOpen(false)} /> : null}
      {archiveTarget ? (
        <SeasonsArchive open={!!archiveTarget} season={archiveTarget} onClose={() => setArchiveTarget(null)} />
      ) : null}
    </>
  );
}

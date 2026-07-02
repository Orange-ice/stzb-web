"use client";

import { useEffect, useRef, useTransition } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { archiveSeasonAction, type SeasonActionState } from "@/app/actions";
import { Button, DatePicker, Form, Input, Modal, Tag, Typography, message } from "antd";

const initialState: SeasonActionState = {
  success: false,
  message: "",
};

type SeasonsArchiveValues = {
  endAt: Dayjs;
};

type SeasonsArchiveSeason = {
  name: string;
  code: string;
  startAt: Date | null;
};

function formatStartDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return dayjs(date).format("YYYY-MM-DD");
}

export default function SeasonsArchive({
  open,
  season,
  onClose,
}: {
  open: boolean;
  season: SeasonsArchiveSeason | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<SeasonsArchiveValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [pending, startTransition] = useTransition();
  const openRef = useRef(open);
  const submitVersionRef = useRef(0);

  useEffect(() => {
    openRef.current = open;

    if (!open) {
      submitVersionRef.current += 1;
      form.resetFields();
      return;
    }

    form.resetFields();
  }, [form, open, season?.code]);

  const handleFinish = (values: SeasonsArchiveValues) => {
    if (!season) {
      return;
    }

    const formData = new FormData();
    formData.set("code", season.code);
    formData.set("endAt", values.endAt.format("YYYY-MM-DD"));
    const submitVersion = submitVersionRef.current + 1;
    submitVersionRef.current = submitVersion;

    startTransition(() => {
      void archiveSeasonAction(initialState, formData).then((nextState) => {
        if (!openRef.current || submitVersionRef.current !== submitVersion) {
          return;
        }

        if (nextState.success) {
          messageApi.success(nextState.message);
          form.resetFields();
          onClose();
          return;
        }

        messageApi.error(nextState.message);
      });
    });
  };

  return (
    <>
      {contextHolder}
      <Modal
        open={open && !!season}
        onCancel={onClose}
        footer={null}
        destroyOnHidden
        centered
        width={560}
        title={
          <div className="space-y-2">
            <Typography.Title level={4} className="!m-0 !text-slate-900">
              归档赛季
            </Typography.Title>
            {season ? (
              <div className="flex items-center gap-2">
                <Typography.Text className="!text-slate-600">{season.name}</Typography.Text>
                <Tag color="blue">{season.code}</Tag>
              </div>
            ) : null}
          </div>
        }
        className="[&_.ant-modal-content]:overflow-hidden [&_.ant-modal-content]:rounded-[28px] [&_.ant-modal-content]:border [&_.ant-modal-content]:border-sky-100 [&_.ant-modal-content]:bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(240,249,255,0.96))] [&_.ant-modal-content]:p-0 [&_.ant-modal-content]:shadow-[0_32px_80px_-36px_rgba(15,23,42,0.35)] [&_.ant-modal-header]:m-0 [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-sky-100/80 [&_.ant-modal-header]:bg-transparent [&_.ant-modal-header]:px-6 [&_.ant-modal-header]:py-5 [&_.ant-modal-body]:px-6 [&_.ant-modal-body]:pb-6 [&_.ant-modal-body]:pt-5"
      >
        <Form<SeasonsArchiveValues>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          autoComplete="off"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label={<span className="text-[13px] font-medium tracking-[0.08em] text-slate-600">开始日期</span>}
              className="mb-0"
            >
              <Input value={formatStartDate(season?.startAt ?? null)} readOnly className="h-11 rounded-xl" />
            </Form.Item>

            <Form.Item<SeasonsArchiveValues>
              label={<span className="text-[13px] font-medium tracking-[0.08em] text-slate-600">结束日期</span>}
              name="endAt"
              rules={[{ required: true, message: "请选择结束日期" }]}
              className="mb-0"
            >
              <DatePicker
                className="h-11 w-full rounded-xl"
                format="YYYY-MM-DD"
                placeholder="选择结束日期"
                disabledDate={(current) => {
                  if (!season?.startAt) {
                    return false;
                  }

                  return current.isBefore(dayjs(season.startAt).startOf("day"));
                }}
              />
            </Form.Item>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button onClick={onClose} className="h-10 rounded-xl px-5">
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={pending}
              className="h-10 rounded-xl px-5 font-medium shadow-[0_14px_30px_-18px_rgba(180,83,9,0.65)]"
            >
              {pending ? "归档中..." : "确认归档"}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}

"use client";

import { useEffect, useRef, useTransition } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Button, DatePicker, Form, Input, Modal } from "antd";

import {
  createSeasonAction,
  type SeasonActionState,
} from "@/app/actions";

const initialState: SeasonActionState = {
  success: false,
  message: "",
};

type SeasonsAddValues = {
  name: string;
  code: string;
  startAt: Dayjs;
};

export default function SeasonsAdd({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<SeasonsAddValues>();
  const [pending, startTransition] = useTransition();
  const openRef = useRef(open);
  const submitVersionRef = useRef(0);

  useEffect(() => {
    openRef.current = open;

    if (!open) {
      submitVersionRef.current += 1;
      form.resetFields();
    }
  }, [form, open]);

  const handleFinish = (values: SeasonsAddValues) => {
    const formData = new FormData();
    formData.set("name", values.name.trim());
    formData.set("code", values.code.trim());
    formData.set("startAt", values.startAt.format("YYYY-MM-DD"));
    const submitVersion = submitVersionRef.current + 1;
    submitVersionRef.current = submitVersion;

    startTransition(() => {
      void createSeasonAction(initialState, formData).then((nextState) => {
        if (!openRef.current || submitVersionRef.current !== submitVersion) {
          return;
        }

        if (nextState.success) {
          form.resetFields();
          onClose();
        }
      });
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={560}
      title={
        <div className="space-y-1">
          <div className="text-lg font-semibold tracking-[0.18em] text-slate-900">
            创建赛季
          </div>
        </div>
      }
      className="[&_.ant-modal-content]:overflow-hidden [&_.ant-modal-content]:rounded-[28px] [&_.ant-modal-content]:border [&_.ant-modal-content]:border-sky-100 [&_.ant-modal-content]:bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(240,249,255,0.96))] [&_.ant-modal-content]:p-0 [&_.ant-modal-content]:shadow-[0_32px_80px_-36px_rgba(15,23,42,0.35)] [&_.ant-modal-header]:m-0 [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-sky-100/80 [&_.ant-modal-header]:bg-transparent [&_.ant-modal-header]:px-6 [&_.ant-modal-header]:py-5 [&_.ant-modal-body]:px-6 [&_.ant-modal-body]:pb-6 [&_.ant-modal-body]:pt-5"
    >
      <Form<SeasonsAddValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        autoComplete="off"
        className="space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Form.Item<SeasonsAddValues>
            label={<span className="text-[13px] font-medium tracking-[0.08em] text-slate-600">赛季名称</span>}
            name="name"
            rules={[
              { required: true, message: "请输入赛季名称" },
              { whitespace: true, message: "赛季名称不能为空" },
            ]}
            className="mb-0 md:col-span-2"
          >
            <Input
              placeholder="例如：S1 开荒赛季"
              className="h-11 rounded-xl"
            />
          </Form.Item>

          <Form.Item<SeasonsAddValues>
            label={<span className="text-[13px] font-medium tracking-[0.08em] text-slate-600">赛季代号</span>}
            name="code"
            rules={[
              { required: true, message: "请输入赛季代号" },
              { whitespace: true, message: "赛季代号不能为空" },
            ]}
            className="mb-0"
          >
            <Input
              placeholder="例如：s1"
              className="h-11 rounded-xl"
            />
          </Form.Item>

          <Form.Item<SeasonsAddValues>
            label={<span className="text-[13px] font-medium tracking-[0.08em] text-slate-600">开始日期</span>}
            name="startAt"
            rules={[{ required: true, message: "请选择开始日期" }]}
            className="mb-0"
          >
            <DatePicker
              className="h-11 w-full rounded-xl"
              format="YYYY-MM-DD"
              placeholder="选择开始日期"
              disabledDate={(current) => current.isBefore(dayjs().startOf("day").subtract(10, "year"))}
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
            className="h-10 rounded-xl px-5 font-medium shadow-[0_14px_30px_-18px_rgba(14,116,144,0.8)]"
          >
            {pending ? "创建中..." : "确认创建"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

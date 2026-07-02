"use client";

import { Layout, Menu, MenuProps } from 'antd';
import { usePathname, useRouter } from 'next/navigation';

const menus: MenuProps['items'] = [
  { key: "/seasons", label: "赛季管理" },
  { key: "/members", label: "成员管理" },
  { key: "/teams", label: "队伍查询" },
  { key: "/sync-records", label: "同步记录" },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  // 成员详情页（/members/<code>/<playerId>）隐藏侧边栏
  const hideSider = /^\/members\/[^/]+\/[^/]+/.test(pathname);

  const onClick: MenuProps['onClick'] = ({ key }) => {
    router.push(String(key));
  };

  return (

    <Layout className="h-dvh">
      {!hideSider && (
      <Layout.Sider theme="light">

        <div className="mx-3 mt-3 rounded-[8px] border border-sky-200/70 bg-[linear-gradient(135deg,#082f49_0%,#0f4c81_48%,#38bdf8_100%)] px-4 py-3 text-sm font-semibold tracking-[0.24em] text-sky-50 shadow-[0_18px_40px_-24px_rgba(14,116,144,0.95)]">
          作战数据分析
        </div>

        <Menu items={menus} onClick={onClick} selectedKeys={[pathname]} />

      </Layout.Sider>
      )}
      <Layout.Content className="overflow-auto border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(240,249,255,0.96)_38%,_rgba(226,232,240,0.92)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_24px_60px_-36px_rgba(15,23,42,0.28)]">{children}</Layout.Content>
    </Layout>
  );
}

import { NextResponse } from "next/server";

import { listSeasonWeeklyWu } from "@/lib/members";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const result = await listSeasonWeeklyWu(code);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取周武勋统计失败",
      },
      { status: 400 },
    );
  }
}

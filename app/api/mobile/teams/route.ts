import { NextResponse } from "next/server";

import { listTeamPlayerSummaries } from "@/lib/team-query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId") ?? "";
    const playerName = searchParams.get("playerName") ?? "";
    const pageParam = searchParams.get("page") ?? "1";
    const pageSizeParam = searchParams.get("pageSize") ?? "20";

    if (!seasonId) {
      return NextResponse.json(
        {
          success: false,
          message: "seasonId 不能为空",
        },
        { status: 400 },
      );
    }

    const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
    const pageSize = Number.isFinite(Number(pageSizeParam)) ? Math.max(1, Number(pageSizeParam)) : 20;

    const result = await listTeamPlayerSummaries({
      seasonId,
      playerName: playerName || undefined,
      isFriendly: false,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取移动端队伍列表失败",
      },
      { status: 400 },
    );
  }
}

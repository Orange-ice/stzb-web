import { NextResponse } from "next/server";

import { getTeamPlayerDetail } from "@/lib/team-query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId") ?? "";
    const playerName = searchParams.get("playerName") ?? "";
    const unionName = searchParams.get("unionName") ?? "";
    const side = searchParams.get("side") ?? "";

    const isFriendly = side === "ally" ? true : side === "enemy" ? false : undefined;

    if (!seasonId || !playerName) {
      return NextResponse.json(
        {
          success: false,
          message: "seasonId 和 playerName 不能为空",
        },
        { status: 400 },
      );
    }

    const detail = await getTeamPlayerDetail({
      seasonId,
      playerName,
      unionName: unionName || undefined,
      isFriendly,
    });

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取队伍详情失败",
      },
      { status: 400 },
    );
  }
}

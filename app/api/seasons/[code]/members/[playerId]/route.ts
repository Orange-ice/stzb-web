import { NextResponse } from "next/server";

import { getSeasonMemberDetail } from "@/lib/members";

type RouteContext = {
  params: Promise<{
    code: string;
    playerId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code, playerId } = await context.params;
    const playerIdInGame = Number(playerId);
    if (!Number.isInteger(playerIdInGame) || playerIdInGame <= 0) {
      throw new Error("成员 ID 无效");
    }

    const result = await getSeasonMemberDetail(code, playerIdInGame);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取成员详情失败",
      },
      { status: 400 },
    );
  }
}

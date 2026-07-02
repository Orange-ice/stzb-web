import { NextResponse } from "next/server";

import { exportSeasonPerformance } from "@/lib/members";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as {
      groups?: string[];
      playerIds?: number[];
      weeks?: number | null;
    };

    const result = await exportSeasonPerformance(code, {
      groups: body.groups ?? [],
      playerIds: body.playerIds ?? [],
      weeks: body.weeks ?? null,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "导出赛季表现失败",
      },
      { status: 400 },
    );
  }
}

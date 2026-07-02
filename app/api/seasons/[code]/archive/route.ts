import { NextResponse } from "next/server";

import { archiveSeason } from "@/lib/seasons";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as { endAt?: string };

    const season = await archiveSeason({
      code,
      endAt: body.endAt ?? "",
    });

    return NextResponse.json({
      success: true,
      data: season,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "归档赛季失败",
      },
      { status: 400 },
    );
  }
}

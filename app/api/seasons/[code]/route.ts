import { NextResponse } from "next/server";

import { deleteSeason } from "@/lib/seasons";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const season = await deleteSeason({ code });

    return NextResponse.json({
      success: true,
      data: season,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "删除赛季失败",
      },
      { status: 400 },
    );
  }
}

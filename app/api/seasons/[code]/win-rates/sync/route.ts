import { NextResponse } from "next/server";

import { syncSeasonWinRates, type WinRateInput } from "@/lib/winrate-sync";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as {
      operatorRole?: string;
      operatorAlliance?: string;
      operatorServer?: string;
      items?: WinRateInput[];
    };

    const result = await syncSeasonWinRates({
      seasonCode: code,
      operatorRole: body.operatorRole ?? "",
      operatorAlliance: body.operatorAlliance,
      operatorServer: body.operatorServer,
      items: body.items ?? [],
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "胜率同步失败",
      },
      { status: 400 },
    );
  }
}

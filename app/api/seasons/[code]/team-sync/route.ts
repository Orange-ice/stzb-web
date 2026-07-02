import { NextResponse } from "next/server";

import { syncSeasonTeams } from "@/lib/sync-records";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as {
      operationType?: string;
      operatorRole?: string;
      operatorAlliance?: string;
      operatorServer?: string;
      items?: Array<Record<string, unknown>>;
    };

    const result = await syncSeasonTeams({
      seasonCode: code,
      operationType: body.operationType ?? "team_query_sync",
      operatorRole: body.operatorRole ?? "",
      operatorAlliance: body.operatorAlliance,
      operatorServer: body.operatorServer,
      items: (body.items ?? []) as never,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "队伍同步失败",
      },
      { status: 400 },
    );
  }
}

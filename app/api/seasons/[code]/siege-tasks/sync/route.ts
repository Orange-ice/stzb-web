import { NextResponse } from "next/server";

import { syncSeasonSiege, type SiegeMemberInput } from "@/lib/siege-sync";

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
      localTaskId?: number;
      taskName?: string;
      targetName?: string;
      targetPosition?: string;
      finishedAt?: number;
      members?: SiegeMemberInput[];
    };

    const result = await syncSeasonSiege({
      seasonCode: code,
      operatorRole: body.operatorRole ?? "",
      operatorAlliance: body.operatorAlliance,
      operatorServer: body.operatorServer,
      localTaskId: body.localTaskId,
      taskName: body.taskName,
      targetName: body.targetName,
      targetPosition: body.targetPosition,
      finishedAt: body.finishedAt,
      members: body.members ?? [],
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "攻城记录同步失败",
      },
      { status: 400 },
    );
  }
}

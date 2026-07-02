import { NextResponse } from "next/server";

import { syncSeasonMembers, type MemberSyncInput } from "@/lib/member-sync";

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
      members?: MemberSyncInput[];
    };

    const result = await syncSeasonMembers({
      seasonCode: code,
      operatorRole: body.operatorRole ?? "",
      operatorAlliance: body.operatorAlliance,
      operatorServer: body.operatorServer,
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
        message: error instanceof Error ? error.message : "成员同步失败",
      },
      { status: 400 },
    );
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { bindMobileTeamSeason } from "@/lib/seasons";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const season = await bindMobileTeamSeason({ code });

    revalidatePath("/seasons");
    revalidatePath("/mobile/teams");

    return NextResponse.json({
      success: true,
      data: season,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "更新移动端默认赛季失败",
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createSeason, listActiveSeasons, listSeasons } from "@/lib/seasons";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const seasons = status === "active" ? await listActiveSeasons() : await listSeasons();

    return NextResponse.json({
      success: true,
      data: seasons,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取赛季列表失败";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const season = await createSeason(body);

    return NextResponse.json(
      {
        success: true,
        data: season,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message: "赛季代号已存在",
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "创建赛季失败";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 },
    );
  }
}

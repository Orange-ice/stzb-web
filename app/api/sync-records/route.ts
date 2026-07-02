import { NextResponse } from "next/server";

import { listSyncRecords } from "@/lib/sync-records";

export async function GET() {
  try {
    const records = await listSyncRecords();

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取同步记录失败",
      },
      { status: 500 },
    );
  }
}

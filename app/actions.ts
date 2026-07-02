"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { archiveSeason, createSeason, deleteSeason } from "@/lib/seasons";

export type SeasonActionState = {
  success: boolean;
  message: string;
};

export async function createSeasonAction(
  _prevState: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    await createSeason({
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      startAt: String(formData.get("startAt") ?? ""),
    });

    revalidatePath("/");

    return {
      success: true,
      message: "赛季创建成功",
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        message: "赛季代号已存在",
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "创建赛季失败",
    };
  }
}

export async function archiveSeasonAction(
  _prevState: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    await archiveSeason({
      code: String(formData.get("code") ?? ""),
      endAt: String(formData.get("endAt") ?? ""),
    });

    revalidatePath("/");

    return {
      success: true,
      message: "赛季已归档",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "归档赛季失败",
    };
  }
}

export async function deleteSeasonAction(
  _prevState: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    await deleteSeason({
      code: String(formData.get("code") ?? ""),
    });

    revalidatePath("/");

    return {
      success: true,
      message: "赛季已删除",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "删除赛季失败",
    };
  }
}

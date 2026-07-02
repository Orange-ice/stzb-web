import { listSeasons } from "@/lib/seasons";
import { SeasonsPageClient } from "./seasons-page-client";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const seasons = await listSeasons();

  return <SeasonsPageClient seasons={seasons} />;
}

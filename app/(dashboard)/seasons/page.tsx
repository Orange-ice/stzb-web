import { listSeasons } from "@/lib/seasons";
import { SeasonsPageClient } from "./seasons-page-client";

export default async function SeasonsPage() {
  const seasons = await listSeasons();

  return <SeasonsPageClient seasons={seasons} />;
}

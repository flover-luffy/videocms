import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getServerIsMobile } from "@/lib/device";
import SeriesDetailDesktop from "@/components/series/SeriesDetailDesktop";
import SeriesDetailMobile from "@/components/series/SeriesDetailMobile";

export const revalidate = 0;

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await prisma.series.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      episodes: {
        orderBy: [{ seasonNum: "asc" }, { episodeNum: "asc" }],
      },
    },
  });

  if (!series) {
    notFound();
  }

  const isMobile = await getServerIsMobile();

  if (isMobile) {
    return <SeriesDetailMobile series={series} />;
  }

  return <SeriesDetailDesktop series={series} />;
}

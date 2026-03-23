"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import MediaCard from "./MediaCard";

interface SeriesItem {
  id: number;
  title: string;
  posterUrl: string | null;
  voteAverage?: number | null;
  year?: number | null;
  episodeCount?: number;
  type?: string;
}

interface MediaRowProps {
  title: string;
  items: SeriesItem[];
  href?: string;
  layout?: "row" | "grid";
  autoScroll?: boolean;
}

export default function MediaRowClient({
  title,
  items,
  href,
  layout = "row",
  autoScroll = false,
}: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      // Scroll by ~90% of the visible container to leave a bit of context
      const scrollAmount =
        direction === "left" ? -(clientWidth * 0.9) : clientWidth * 0.9;

      // Loop logic for autoScroll
      if (
        direction === "right" &&
        scrollLeft + clientWidth >= scrollWidth - 10
      ) {
        rowRef.current.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      rowRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  /** 自动滚动逻辑：仅在 layout="row" 且开启 autoScroll 时生效 */
  useEffect(() => {
    if (!autoScroll || layout !== "row" || items.length < 5) return;

    let intervalId: NodeJS.Timeout;

    const startInterval = () => {
      intervalId = setInterval(() => {
        scroll("right");
      }, 6000); // 6秒滚动一次，保持阅读舒适度
    };

    const handleMouseEnter = () => clearInterval(intervalId);
    const handleMouseLeave = () => startInterval();

    startInterval();

    const rowElement = rowRef.current;
    if (rowElement) {
      rowElement.addEventListener("mouseenter", handleMouseEnter);
      rowElement.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      clearInterval(intervalId);
      if (rowElement) {
        rowElement.removeEventListener("mouseenter", handleMouseEnter);
        rowElement.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [autoScroll, layout, items.length]);

  if (!items || items.length === 0) return null;

  return (
    <section className="relative flex flex-col pt-6 pb-10 group z-20">
      <div className="flex items-end justify-between px-[5vw] mb-4">
        <h2 className="font-outfit text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-white/95 uppercase">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-500 hover:text-white transition-all drop-shadow-[0_0_12px_rgba(217,119,6,0.3)] bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10"
          >
            View All
          </Link>
        )}
      </div>

      <div className="relative">
        {layout === "grid" ? (
          /* Unified Static Grid - Strictly following 2:3 aspect tokens */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-12 px-[5vw] pt-2">
            {items.map((item) => (
              <div key={item.id} className="w-full">
                <MediaCard {...item} />
              </div>
            ))}
          </div>
        ) : (
          /* Horizontal Scroll Container */
          <>
            <div
              ref={rowRef}
              className="flex overflow-x-auto gap-4 sm:gap-6 md:gap-8 px-[5vw] pb-10 pt-2 scrollbar-hide snap-x snap-mandatory"
              // Safe spacing to prevent hover shadow clipping
              style={{ scrollPaddingLeft: "5vw", scrollPaddingRight: "5vw" }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="w-[150px] sm:w-[220px] md:w-[260px] lg:w-[300px] xl:w-[320px] shrink-0 snap-start"
                >
                  <MediaCard {...item} />
                </div>
              ))}
            </div>

            {/* Elegant Navigation Arrows overlay perfectly on top of the left/right safe areas */}
            <div className="absolute inset-y-0 left-0 w-[4vw] bg-gradient-to-r from-[#0C0A09] via-[#0C0A09]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
              <button
                onClick={() => scroll("left")}
                className="pointer-events-auto h-full w-full flex items-center justify-center text-white/50 hover:text-white hover:scale-110 active:scale-95 transition-all"
                aria-label="向左滑动"
              >
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-2xl"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>

            <div className="absolute inset-y-0 right-0 w-[4vw] bg-gradient-to-l from-[#0C0A09] via-[#0C0A09]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
              <button
                onClick={() => scroll("right")}
                className="pointer-events-auto h-full w-full flex items-center justify-center text-white/50 hover:text-white hover:scale-110 active:scale-95 transition-all"
                aria-label="向右滑动"
              >
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-2xl"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

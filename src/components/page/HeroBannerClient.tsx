"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { BannerItem } from "./HeroBannerDesktop";

const HeroBannerDesktop = dynamic(() => import("./HeroBannerDesktop"));
const HeroBannerMobile = dynamic(() => import("./HeroBannerMobile"));

interface Props {
  items: BannerItem[];
  isMobile: boolean;
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) =>
  Math.abs(offset) * velocity;

export default function HeroBannerClient({ items, isMobile }: Props) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const itemIndex = ((page % items.length) + items.length) % items.length;

  const paginate = useCallback((newDirection: number) => {
    setPage((current) => [current[0] + newDirection, newDirection]);
  }, []);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return undefined;
    timerRef.current = setTimeout(() => paginate(1), 10000); // 10s interval
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items.length, isPaused, paginate, page]);

  if (!items || items.length === 0) return null;

  const variants = {
    enter: (stepDirection: number) => ({
      x: stepDirection > 0 ? "50%" : "-50%",
      opacity: 0,
      scale: 1.05,
    }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (stepDirection: number) => ({
      zIndex: 0,
      x: stepDirection < 0 ? "20%" : "-20%",
      opacity: 0,
      scale: 0.95,
    }),
  };

  const commonProps = {
    items,
    page,
    direction,
    itemIndex,
    paginate,
    setPage,
    reduceMotion: false,
    variants,
    swipePower,
    swipeConfidenceThreshold,
  };

  if (isMobile) {
    return <HeroBannerMobile {...commonProps} />;
  }

  return <HeroBannerDesktop {...commonProps} setIsPaused={setIsPaused} />;
}

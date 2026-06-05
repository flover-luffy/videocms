"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { memo } from "react";

interface Props {
  children: ReactNode[];
  className?: string;
}

const containerVars: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVars: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

function StaggeredList({ children, className }: Props) {
  return (
    <motion.div
      variants={containerVars}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className={className}
    >
      {children.map((child, idx) => (
        <motion.div key={idx} variants={itemVars}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export default memo(StaggeredList);

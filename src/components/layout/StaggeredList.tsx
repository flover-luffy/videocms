"use client";
import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

interface Props {
    children: ReactNode[];
    className?: string;
}

const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVars: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1],
        }
    },
};

export default function StaggeredList({ children, className }: Props) {
    return (
        <motion.div
            variants={containerVars}
            initial="hidden"
            animate="visible"
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

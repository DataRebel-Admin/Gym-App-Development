"use client";

import { m } from "motion/react";
import { fadeUp, staggerContainer } from "./variants";

/**
 * Onthult een sectie met een fade/slide-up zodra die in beeld komt.
 * Gebruik `<Reveal>` rond een blok, of `<Reveal stagger>` met meerdere
 * `<RevealItem>`-kinderen voor een gestaggerd effect.
 */
export function Reveal({
  children,
  stagger = false,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  stagger?: boolean;
  className?: string;
  as?: "div" | "section" | "ul" | "li";
}) {
  const Tag = m[as];
  return (
    <Tag
      className={className}
      variants={stagger ? staggerContainer : fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </Tag>
  );
}

/** Eén item binnen een `<Reveal stagger>`-container. */
export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul" | "li";
}) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={fadeUp}>
      {children}
    </Tag>
  );
}

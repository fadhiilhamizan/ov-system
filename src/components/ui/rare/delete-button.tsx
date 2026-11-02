"use client";

// Adapted from Rare UI (https://rareui.com), components/ui/delete-button.tsx.
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution, see
// ./LICENSE; the credit link lives in the app footer (app-shell.tsx).
//
// OV changes:
// - `size="sm"` (26px) for table rows and `size="xs"` (22px) for tight
//   headers, so the bin sits level with the row's other icon buttons
//   instead of upstream's 48px tile.
// - The confirm panel OVERLAYS its neighbours instead of widening the
//   element: the root always reserves exactly one tile, so opening it in a
//   table cell never reflows the column. `side` picks which way it opens;
//   rows open to the left because the button sits at the row's right edge.
// - Escape is stopped here, so it backs out of the delete without also
//   pressing a bulk bar's Escape shortcut; a click outside backs out too.
// - Colours from the app's tokens, labels through t().

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
} from "motion/react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

const HINGE = "3px 6px";
const LID_OPEN = -35;
const WALL_TOP = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE = 20;

const HOLD = { deleted: 1400, kept: 600 };

const SIZES = {
  xs: { tile: 22, panel: 50, icon: 13, check: 13, circle: "size-[18px]", circleIcon: 9, radius: "rounded-md" },
  sm: { tile: 26, panel: 56, icon: 14, check: 15, circle: "size-5", circleIcon: 10, radius: "rounded-lg" },
  md: { tile: 48, panel: 84, icon: 20, check: 20, circle: "size-7", circleIcon: 14, radius: "rounded-2xl" },
} as const;

const EASE = [0.32, 0.72, 0, 1] as const;
const EASE_LID = [0.34, 1.1, 0.64, 1] as const;

const WIDTH = { duration: 0.62, ease: EASE } as const;
const LID = { duration: 0.6, ease: EASE_LID } as const;
const WALL = { duration: 0.56, ease: EASE } as const;
const IN = { duration: 0.44, ease: EASE, delay: 0.14 } as const;
const OUT = { duration: 0.3, ease: EASE } as const;
const TAP = { duration: 0.2, ease: EASE } as const;
const SWAP = { duration: 0.22, ease: EASE } as const;
const SETTLE = { duration: 0.45, ease: EASE } as const;
const PRESS = {
  type: "spring",
  stiffness: 520,
  damping: 18,
  mass: 0.5,
} as const;
const INSTANT = { duration: 0 } as const;

// The recess is a translucent shade over the surface rather than a token of
// its own, so it reads darker than the surface in both themes.
const RECESS = "bg-black/[0.06] dark:bg-black/30";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ACCENT = "var(--danger)";

const LIFT =
  "shadow-[0_0.5px_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9)] dark:shadow-[0_0.5px_1px_rgba(0,0,0,0.35),0_1.5px_4px_rgba(0,0,0,0.25),inset_0_0.5px_0_rgba(255,255,255,0.07)]";

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// The panel slides in from the bin's side, whichever way it opens.
const panelMotion = (from: number) => ({
  hidden: { opacity: 0, x: from, transition: OUT },
  shown: { opacity: 1, x: 0, transition: { ...IN, staggerChildren: 0.07 } },
});

const circleMotion = {
  hidden: { opacity: 0, scale: 0.9, transition: OUT },
  shown: { opacity: 1, scale: 1, transition: IN },
};

function Circle({
  label,
  onClick,
  className,
  iconSize,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  iconSize: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div className="flex" variants={reduced ? undefined : circleMotion}>
      <motion.button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.84 }}
        transition={PRESS}
        className={cn(
          "grid place-items-center rounded-full bg-card text-muted-foreground transition-colors duration-200 hover:bg-accent",
          FOCUS,
          LIFT,
          className,
        )}
      >
        <svg
          {...ICON}
          width={iconSize}
          height={iconSize}
          stroke="currentColor"
          strokeWidth="3.5"
        >
          {children}
        </svg>
      </motion.button>
    </motion.div>
  );
}

type Status = "idle" | "deleted" | "kept";

export type DeleteButtonProps = Omit<
  ComponentProps<"span">,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
> & {
  onConfirm?: () => void;
  onCancel?: () => void;
  size?: keyof typeof SIZES;
  /** Which way the confirm panel opens from the bin. */
  side?: "left" | "right";
  /** The bin's accessible name, e.g. "Hapus baris". Defaults to "Hapus". */
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
};

export function DeleteButton({
  className,
  onConfirm,
  onCancel,
  size = "md",
  side = "right",
  label,
  confirmLabel,
  cancelLabel,
  disabled,
  ...props
}: DeleteButtonProps) {
  const t = useT();
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timing = (transition: Transition) => (reduced ? INSTANT : transition);
  const dims = SIZES[size];
  const binLabel = label ?? t("Hapus");

  const top = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const bin = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);

  useEffect(() => {
    const walls = animate(
      top,
      open ? WALL_TOP_OPEN : WALL_TOP,
      reduced ? INSTANT : WALL,
    );
    return () => walls.stop();
  }, [open, reduced, top]);

  useEffect(() => {
    if (status === "idle") return;
    const nudge =
      status === "kept" && !reduced
        ? animate(settle, [1, 0.86, 1], SETTLE)
        : null;
    const done = setTimeout(() => setStatus("idle"), HOLD[status]);
    return () => {
      nudge?.stop();
      clearTimeout(done);
    };
  }, [status, reduced, settle]);

  const resolve = (next: Exclude<Status, "idle">, refocus = true) => {
    setOpen(false);
    setStatus(next);
    if (refocus) trigger.current?.focus();
    (next === "deleted" ? onConfirm : onCancel)?.();
  };

  // A click anywhere else backs out, the way a popover closes. Focus is left
  // where the click put it.
  const resolveRef = useRef(resolve);
  useEffect(() => {
    resolveRef.current = resolve;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) resolveRef.current("kept", false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const leftward = side === "left";

  return (
    <span
      ref={root}
      data-slot="delete-button"
      data-state={open ? "open" : "closed"}
      data-status={status}
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{ width: dims.tile, height: dims.tile }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          resolve("kept");
        }
      }}
      {...props}
    >
      <motion.span
        className={cn(
          "absolute inset-y-0 block text-muted-foreground transition-[background-color,box-shadow] duration-200",
          dims.radius,
          leftward ? "right-0" : "left-0",
          size === "md" && "bg-muted",
          open && "z-30 bg-muted shadow-md ring-1 ring-border",
        )}
        initial={false}
        animate={{ width: open ? dims.tile + dims.panel : dims.tile }}
        transition={timing(WIDTH)}
      >
        <motion.button
          ref={trigger}
          type="button"
          aria-label={binLabel}
          title={binLabel}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (open) return resolve("kept");
            setStatus("idle");
            setOpen(true);
          }}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          transition={TAP}
          style={{ width: dims.tile, height: dims.tile }}
          className={cn(
            "absolute top-0 z-10 grid place-items-center transition-colors disabled:pointer-events-none disabled:opacity-50",
            dims.radius,
            leftward ? "right-0" : "left-0",
            size !== "md" && !open && "hover:bg-danger/10 hover:text-danger",
            FOCUS,
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {status === "deleted" ? (
              <motion.svg
                key="done"
                {...ICON}
                width={dims.check}
                height={dims.check}
                stroke={ACCENT}
                strokeWidth="2.5"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={timing(SWAP)}
              >
                <motion.path
                  d="M4 12.5 9.5 18 20 7"
                  initial={reduced ? undefined : { pathLength: 0 }}
                  animate={reduced ? undefined : { pathLength: 1 }}
                  transition={SETTLE}
                />
              </motion.svg>
            ) : (
              <motion.svg
                key="bin"
                {...ICON}
                width={dims.icon}
                height={dims.icon}
                stroke="currentColor"
                strokeWidth="2"
                className="overflow-visible"
                style={{ scale: settle }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={timing(SWAP)}
              >
                <motion.path d={bin} />
                <motion.g
                  style={{ transformBox: "view-box", transformOrigin: HINGE }}
                  animate={{ rotate: open ? LID_OPEN : 0 }}
                  transition={timing(LID)}
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </motion.g>
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        <span role="status" aria-live="polite" className="sr-only">
          {status === "deleted" ? t("Dihapus") : status === "kept" ? t("Tidak jadi dihapus") : ""}
        </span>

        <AnimatePresence>
          {open && (
            <motion.span
              key="panel"
              style={{ width: dims.panel }}
              className={cn(
                "absolute inset-y-0 flex items-center justify-center gap-1.5",
                dims.radius,
                leftward ? "left-0" : "right-0",
                RECESS,
              )}
              variants={reduced ? undefined : panelMotion(leftward ? 6 : -6)}
              initial="hidden"
              animate="shown"
              exit="hidden"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 z-20 h-2.5 w-1.5 -translate-y-1/2",
                  leftward
                    ? "-right-1.5 [clip-path:polygon(0_0,100%_50%,0_100%)]"
                    : "-left-1.5 [clip-path:polygon(100%_0,0_50%,100%_100%)]",
                  RECESS,
                )}
              />
              <Circle
                label={confirmLabel ?? t("Ya, hapus")}
                onClick={() => resolve("deleted")}
                className={dims.circle}
                iconSize={dims.circleIcon}
              >
                <path d="M4 12.5 9.5 18 20 7" stroke={ACCENT} />
              </Circle>
              <Circle
                label={cancelLabel ?? t("Batal")}
                onClick={() => resolve("kept")}
                className={dims.circle}
                iconSize={dims.circleIcon}
              >
                <path d="M6 6 18 18M18 6 6 18" />
              </Circle>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </span>
  );
}

export default DeleteButton;

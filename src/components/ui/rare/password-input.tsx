"use client";

// Adapted from Rare UI (https://rareui.com), components/ui/password-input.tsx.
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution, see
// ./LICENSE; the credit link lives in the app footer (app-shell.tsx).
//
// How it works: the real <input> keeps the value, the focus and the native
// behaviour (password managers, form submit, `required`), but its text is
// transparent; a layer on top draws one glyph per character, so each dot can
// cross-fade into its letter when the eye opens.
//
// OV changes:
// - Looks like the app's <Input> (h-9, border, card background, focus ring)
//   and spans its column instead of upstream's fixed max-w-xs pill.
// - The strength meter sits IN the flow and grows open, rather than hanging
//   absolutely under the field, so it cannot cover the hint line below it.
//   Its scoring is `passwordStrength` in lib/password.ts, which knows the
//   8-character minimum.
// - Browser autofill. Chrome fills a saved password on page load but keeps
//   the value from JavaScript until the user interacts, so the drawn layer
//   had nothing to draw and the field LOOKED empty while holding a password.
//   While that is the case (`:autofill` matched, no value seen yet) the
//   input's own text is shown instead; the first input event hands over to
//   the drawn layer.
// - Labels through t().

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/password";
import { useT } from "@/lib/i18n/provider";

// Indexed by strength - 1. The labels are translated in the component, as
// literal t() calls, so the i18n coverage scan can see them.
const LEVEL_COLORS = [
  "var(--danger)",
  "var(--warning)",
  "color-mix(in srgb, var(--warning) 45%, var(--success))",
  "var(--success)",
] as const;

const LID_OPEN = { top: 5.5, bottom: 18.5 };
const LID_CLOSED = { top: 17, bottom: 17 };
const LASHES = [
  "M4.4 14.6 3 16.4",
  "M9 16.6 8.5 19",
  "M15 16.6l.5 2.4",
  "M19.6 14.6l1.4 1.8",
];

const INSTANT: Transition = { duration: 0 };
const SPRING: Transition = { type: "spring", stiffness: 520, damping: 32 };
const LID_SPRING: Transition = { type: "spring", stiffness: 500, damping: 34 };
const SWAP: Transition = { duration: 0.12, ease: "easeOut" };
const REVEAL: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };
const BLINK: Transition = {
  duration: 1.1,
  times: [0, 0.5, 0.5, 1],
  repeat: Infinity,
  ease: "linear",
};

// The input and the drawn layer must share one font and size, or the caret
// (positioned in `ch`) drifts off the glyphs. 16px on phones so iOS does not
// zoom into the field, 14px like every other input from sm up.
const TEXT = "font-mono text-base sm:text-sm";

const corner = (y: number) => 12 + (y - 12) * 0.64;

const eyePath = ({ top, bottom }: { top: number; bottom: number }) =>
  `M2 12C4 ${corner(top)} 7.5 ${top} 12 ${top}C16.5 ${top} 20 ${corner(top)} 22 12C20 ${corner(bottom)} 16.5 ${bottom} 12 ${bottom}C7.5 ${bottom} 4 ${corner(bottom)} 2 12Z`;

function Glyph({
  char,
  visible,
  reduceMotion,
}: {
  char: string;
  visible: boolean;
  reduceMotion: boolean;
}) {
  const transition = reduceMotion ? INSTANT : SWAP;

  return (
    <span className="relative grid h-full w-[1ch] shrink-0 place-items-center">
      <motion.span
        data-slot="password-input-dot"
        initial={false}
        animate={{ opacity: visible ? 0 : 1 }}
        transition={transition}
        className="absolute size-[0.36em] rounded-full bg-current"
      />
      <motion.span
        data-slot="password-input-char"
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={transition}
        className="whitespace-pre"
      >
        {char}
      </motion.span>
    </span>
  );
}

function Eye({ open, reduceMotion }: { open: boolean; reduceMotion: boolean }) {
  const clipId = useId();
  const lid = { d: eyePath(open ? LID_OPEN : LID_CLOSED) };
  const transition = reduceMotion ? INSTANT : LID_SPRING;

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] overflow-visible"
    >
      <clipPath id={clipId}>
        <motion.path initial={false} animate={lid} transition={transition} />
      </clipPath>
      <circle cx={12} cy={12} r={3} clipPath={`url(#${clipId})`} />
      <motion.path initial={false} animate={lid} transition={transition} />
      {LASHES.map((d) => (
        <motion.path
          key={d}
          d={d}
          initial={false}
          animate={{ pathLength: open ? 0 : 1, opacity: open ? 0 : 1 }}
          transition={
            reduceMotion ? INSTANT : { duration: 0.2, delay: open ? 0 : 0.08 }
          }
        />
      ))}
    </svg>
  );
}

export type PasswordInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "size"
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** Show the strength meter. Only for choosing a NEW password. */
  strength?: boolean;
  inputClassName?: string;
};

export function PasswordInput({
  value,
  defaultValue = "",
  onChange,
  defaultVisible = false,
  onVisibleChange,
  strength = false,
  placeholder,
  disabled,
  autoComplete = "current-password",
  className,
  inputClassName,
  onFocus,
  onBlur,
  ...props
}: PasswordInputProps) {
  const t = useT();
  const levelLabels = [t("Lemah"), t("Cukup"), t("Baik"), t("Kuat")];
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [visible, setVisible] = useState(defaultVisible);
  const [focused, setFocused] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0, scroll: 0 });
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef(0);
  const reduceMotion = useReducedMotion() ?? false;

  const password = value ?? uncontrolled;
  const chars = Array.from(password);
  const level = passwordStrength(password);
  // The browser holds a value we cannot see yet: let it draw its own text.
  const native = autofilled && password === "";
  const animated = (transition: Transition) =>
    reduceMotion ? INSTANT : transition;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const read = () => {
    const el = input.current;
    if (!el) return;
    // selection offsets count utf-16 units, the glyphs count code points
    const start = Array.from(el.value.slice(0, el.selectionStart ?? 0)).length;
    const end = Array.from(el.value.slice(0, el.selectionEnd ?? 0)).length;
    const scroll = el.scrollLeft;
    setSelection((current) =>
      current.start === start &&
      current.end === end &&
      current.scroll === scroll
        ? current
        : { start, end, scroll },
    );
  };

  // read now so the caret moves with the keystroke, then again once scrollLeft settles
  const sync = () => {
    read();
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(read);
  };

  const toggle = () => {
    const el = input.current;
    const start = el?.selectionStart ?? null;
    const end = el?.selectionEnd ?? null;
    setVisible(!visible);
    onVisibleChange?.(!visible);
    // switching the input type drops the selection in some browsers
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (el && start !== null && end !== null && document.activeElement === el)
        el.setSelectionRange(start, end);
      read();
    });
  };

  return (
    <div
      data-slot="password-input"
      data-visible={visible}
      className={cn(
        "relative flex w-full flex-col",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <div
        data-slot="password-input-field"
        className="relative flex h-9 items-center rounded-lg border border-input bg-card text-foreground shadow-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
      >
        <div className="relative h-full min-w-0 flex-1">
          <input
            ref={input}
            {...props}
            type={visible ? "text" : "password"}
            value={password}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-slot="password-input-control"
            onChange={(event) => {
              if (value === undefined) setUncontrolled(event.target.value);
              setAutofilled(false);
              onChange?.(event.target.value);
              sync();
            }}
            // globals.css runs a 1ms `ov-autofill` animation on :autofill,
            // which is the only event a browser gives for it.
            onAnimationStart={(event) => {
              if (event.animationName === "ov-autofill") setAutofilled(true);
            }}
            onSelect={sync}
            onScroll={sync}
            onFocus={(event) => {
              setFocused(true);
              sync();
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            className={cn(
              "ov-autofill-watch absolute inset-0 size-full rounded-lg bg-transparent pl-3 pr-1 outline-none selection:bg-transparent placeholder:text-transparent autofill:shadow-[inset_0_0_0_100px_var(--card)] [&::-ms-reveal]:hidden",
              TEXT,
              native
                ? "text-foreground"
                : "text-transparent caret-transparent [-webkit-text-fill-color:transparent]",
              inputClassName,
            )}
          />

          <div
            aria-hidden
            data-slot="password-input-display"
            className={cn("pointer-events-none absolute inset-y-0 left-3 right-1 overflow-hidden", TEXT, native && "invisible")}
          >
            {!password && placeholder && (
              <span className="absolute inset-y-0 left-0 flex items-center font-sans text-muted-foreground">
                {placeholder}
              </span>
            )}

            <div
              className="relative flex h-full items-center"
              style={{ transform: `translateX(${-selection.scroll}px)` }}
            >
              {focused && selection.end > selection.start && (
                <span
                  className="absolute top-1/2 h-5 -translate-y-1/2 rounded bg-primary/25"
                  style={{
                    left: `${selection.start}ch`,
                    width: `${selection.end - selection.start}ch`,
                  }}
                />
              )}

              {chars.map((char, index) => (
                <Glyph
                  key={index}
                  char={char}
                  visible={visible}
                  reduceMotion={reduceMotion}
                />
              ))}

              {focused && selection.start === selection.end && (
                <motion.span
                  // remounting restarts the blink, so the caret stays solid while typing
                  key={`${selection.end}:${chars.length}`}
                  data-slot="password-input-caret"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={BLINK}
                  style={{ left: `${selection.end}ch` }}
                  className="absolute top-1/2 -ml-px h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground"
                />
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          data-slot="password-input-toggle"
          aria-label={t("Tampilkan kata sandi")}
          aria-pressed={visible}
          title={visible ? t("Sembunyikan kata sandi") : t("Tampilkan kata sandi")}
          disabled={disabled}
          onPointerDown={(event) => event.preventDefault()}
          onClick={toggle}
          className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Eye open={visible} reduceMotion={reduceMotion} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {strength && level > 0 && (
          <motion.div
            data-slot="password-input-strength"
            data-level={level}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={animated(REVEAL)}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 px-0.5 pt-2">
              <div className="flex gap-1.5">
                {LEVEL_COLORS.map((_, index) => (
                  <span
                    key={index}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                  >
                    {/* Only the fill is animated by motion; the colour is a CSS
                        variable, which it cannot interpolate, so a plain
                        transition handles that. */}
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: index < level ? 1 : 0 }}
                      transition={animated({ ...SPRING, delay: index * 0.04 })}
                      style={{ backgroundColor: LEVEL_COLORS[level - 1] }}
                      className="block h-full origin-left rounded-full transition-colors duration-300"
                    />
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t("Kekuatan kata sandi")}
                </span>
                <span
                  aria-live="polite"
                  className="relative flex h-4 justify-end overflow-hidden font-medium text-foreground/80"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={level}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={animated(SPRING)}
                    >
                      {levelLabels[level - 1]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PasswordInput;

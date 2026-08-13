"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { parseMarkdown, type Block, type Inline } from "@/lib/violet/markdown";
import { resolveHref } from "@/lib/violet/links";
import { cn } from "@/lib/utils";

/**
 * Renders one of Violet's answers.
 *
 * The model writes markdown whether or not you ask it to, and this bubble used
 * to print it literally: answers arrived full of stray "**" and numbered lines
 * that never became a list.
 *
 * Everything here is real React elements built from the parsed tokens. There is
 * no `dangerouslySetInnerHTML` and no HTML passthrough, so a model that emits
 * a `<script>` tag gets a bubble containing the literal text "<script>".
 *
 * A link is rendered as a link only when `resolveHref` recognises the path.
 * Anything else, an invented route or an external URL, degrades to its label as
 * plain text. That is the safety net behind the "do not invent paths" rule in
 * the prompt: prompts are advice, this is enforcement.
 */
export function RichText({
  text,
  onNavigate,
  className,
}: {
  text: string;
  /** Called when a shortcut is followed, so the panel can close itself. */
  onNavigate?: () => void;
  className?: string;
}) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function BlockView({ block, onNavigate }: { block: Block; onNavigate?: () => void }) {
  const inline = (parts: Inline[]) => <InlineView parts={parts} onNavigate={onNavigate} />;

  switch (block.type) {
    case "para":
      return <p>{inline(block.inline)}</p>;

    case "heading":
      return (
        <p className={cn("font-semibold", block.level <= 2 ? "text-[15px]" : "text-sm")}>
          {inline(block.inline)}
        </p>
      );

    case "quote":
      return (
        <p className="border-l-2 border-violet-400/60 pl-3 text-muted-foreground">
          {inline(block.inline)}
        </p>
      );

    case "bullets":
      return (
        <ul className="space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-violet-400" />
              <span className="min-w-0 flex-1">{inline(item)}</span>
            </li>
          ))}
        </ul>
      );

    case "ordered":
      return (
        <ol className="space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-px shrink-0 text-xs font-semibold tabular-nums text-violet-500">
                {block.start + i}.
              </span>
              <span className="min-w-0 flex-1">{inline(item)}</span>
            </li>
          ))}
        </ol>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-foreground/5 p-2.5 text-xs">
          <code>{block.text}</code>
        </pre>
      );

    case "rule":
      return <hr className="border-border/70" />;
  }
}

function InlineView({ parts, onNavigate }: { parts: Inline[]; onNavigate?: () => void }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case "bold":
            return (
              <strong key={i} className="font-semibold">
                <InlineView parts={p.children} onNavigate={onNavigate} />
              </strong>
            );
          case "italic":
            return (
              <em key={i}>
                <InlineView parts={p.children} onNavigate={onNavigate} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-foreground/10 px-1 py-0.5 text-[0.85em]">
                {p.text}
              </code>
            );
          case "link": {
            const href = resolveHref(p.href);
            // A path we do not serve becomes plain text. Sending someone to a
            // 404 is worse than not offering the shortcut at all.
            if (!href) return <span key={i}>{p.text}</span>;
            return (
              <Link
                key={i}
                href={href}
                onClick={onNavigate}
                className="inline-flex items-baseline gap-0.5 font-medium text-violet-600 underline decoration-violet-400/50 underline-offset-2 transition hover:decoration-violet-500 dark:text-violet-300"
              >
                {p.text}
                <ArrowUpRight className="size-3 shrink-0 self-center" />
              </Link>
            );
          }
          default:
            return <React.Fragment key={i}>{p.text}</React.Fragment>;
        }
      })}
    </>
  );
}

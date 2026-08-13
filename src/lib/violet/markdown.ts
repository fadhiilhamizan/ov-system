// ============================================================
// A very small markdown parser, for Violet's answers only.
//
// The model already writes markdown whether or not anyone asks it to, and the
// chat bubble used to render it as literal text: answers arrived full of
// stray "**" and "1." lines that never became a list. Rendering it properly is
// the difference between a wall of text and a readable answer.
//
// Hand-rolled rather than pulling in a markdown library plus a sanitiser,
// because this parser is a WHITELIST: it understands bold, italic, inline
// code, headings, blockquotes, fenced code, bullet and numbered lists, and
// links. Everything else stays literal text. There is no raw-HTML path at all,
// so there is nothing for a sanitiser to clean, and the renderer never touches
// dangerouslySetInnerHTML.
//
// Link targets are NOT resolved here. The parser records the href it was
// given; `resolveHref` in ./links decides whether it points anywhere real.
// Keeping those apart is what makes both of them testable.
// ============================================================

export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  // Emphasis nests: the model routinely writes a bold link,
  // "**[Work Breakdown](/tasks)**", and treating the inside as flat text
  // printed the brackets and the path at the reader.
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] };

export type Block =
  | { type: "para"; inline: Inline[] }
  | { type: "heading"; level: number; inline: Inline[] }
  | { type: "quote"; inline: Inline[] }
  | { type: "bullets"; items: Inline[][] }
  | { type: "ordered"; start: number; items: Inline[][] }
  | { type: "code"; text: string }
  | { type: "rule" };

/**
 * One pass over a line, longest-marker-first.
 *
 * `**` has to be tried before `*` or "**bold**" parses as an empty italic
 * followed by stray text. Markers must hug their content ("** bold **" is
 * literal), which is what keeps a lone asterisk in prose from swallowing the
 * rest of the sentence.
 */
const INLINE_RE = new RegExp(
  [
    "`([^`\\n]+)`", // 1: inline code (first, so markers inside it stay literal)
    "\\[([^\\]\\n]*)\\]\\(([^)\\s]+)\\)", // 2: link text, 3: href
    "\\*\\*(\\S(?:[^*]*\\S)?)\\*\\*", // 4: bold
    "__(\\S(?:[^_]*\\S)?)__", // 5: bold
    "\\*(\\S(?:[^*]*\\S)?)\\*", // 6: italic
    "_(\\S(?:[^_]*\\S)?)_", // 7: italic
  ].join("|"),
  "g",
);

/**
 * Guard against a pathological nest. Emphasis recursion always shrinks the
 * string it is given, so this can only be hit by absurd input, but an answer is
 * never worth a blown stack.
 */
const MAX_DEPTH = 6;

/** Parse the markers inside a single line of text. */
export function parseInline(line: string, depth = 0): Inline[] {
  if (depth >= MAX_DEPTH) return [{ type: "text", text: line }];

  const out: Inline[] = [];
  let last = 0;
  const push = (text: string) => {
    if (text) out.push({ type: "text", text });
  };
  const inner = (text: string) => parseInline(text, depth + 1);

  for (const m of line.matchAll(INLINE_RE)) {
    push(line.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) out.push({ type: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "link", text: m[2] || m[3], href: m[3] });
    else if (m[4] !== undefined) out.push({ type: "bold", children: inner(m[4]) });
    else if (m[5] !== undefined) out.push({ type: "bold", children: inner(m[5]) });
    else if (m[6] !== undefined) out.push({ type: "italic", children: inner(m[6]) });
    else if (m[7] !== undefined) out.push({ type: "italic", children: inner(m[7]) });
  }
  push(line.slice(last));
  return out.length ? out : [{ type: "text", text: "" }];
}

/** The visible characters of a run of inline nodes, markers removed. */
export function inlineText(parts: Inline[]): string {
  return parts
    .map((p) => (p.type === "bold" || p.type === "italic" ? inlineText(p.children) : p.text))
    .join("");
}

// A bullet may be written with -, *, + or the bullet character the model likes
// to use when it is writing Indonesian.
const BULLET_RE = /^\s{0,3}[-*+•]\s+(.*)$/;
const ORDERED_RE = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const HEADING_RE = /^\s{0,3}(#{1,4})\s+(.*)$/;
const QUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const RULE_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const FENCE_RE = /^\s{0,3}```/;

/** Turn an answer into blocks. Never throws: unparseable input stays text. */
export function parseMarkdown(source: string): Block[] {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  // Consecutive plain lines are joined into one paragraph, so a model that
  // hard-wraps its prose does not produce a stack of one-line paragraphs.
  let para: string[] = [];
  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ type: "para", inline: parseInline(para.join(" ")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) body.push(lines[i++]);
      // An unterminated fence still yields a code block: the alternative is
      // silently dropping the rest of the answer.
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flushPara();
      continue;
    }

    if (RULE_RE.test(line)) {
      flushPara();
      blocks.push({ type: "rule" });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ type: "heading", level: heading[1].length, inline: parseInline(heading[2]) });
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      flushPara();
      blocks.push({ type: "quote", inline: parseInline(quote[1]) });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushPara();
      const items = [parseInline(bullet[1])];
      while (i + 1 < lines.length) {
        const next = BULLET_RE.exec(lines[i + 1]);
        if (!next) break;
        items.push(parseInline(next[1]));
        i++;
      }
      blocks.push({ type: "bullets", items });
      continue;
    }

    const ordered = ORDERED_RE.exec(line);
    if (ordered) {
      flushPara();
      const items = [parseInline(ordered[2])];
      while (i + 1 < lines.length) {
        const next = ORDERED_RE.exec(lines[i + 1]);
        if (!next) break;
        items.push(parseInline(next[2]));
        i++;
      }
      // Respect the model's own numbering: it sometimes continues a list that
      // was interrupted by a paragraph.
      blocks.push({ type: "ordered", start: Number(ordered[1]) || 1, items });
      continue;
    }

    para.push(line.trim());
  }

  flushPara();
  return blocks;
}

/** The answer with its markers removed, for the clipboard and for tests. */
export function toPlainText(source: string): string {
  return parseMarkdown(source)
    .map((b) => {
      const flat = inlineText;
      switch (b.type) {
        case "para":
        case "heading":
          return flat(b.inline);
        case "quote":
          return flat(b.inline);
        case "bullets":
          return b.items.map((it) => `- ${flat(it)}`).join("\n");
        case "ordered":
          return b.items.map((it, i) => `${b.start + i}. ${flat(it)}`).join("\n");
        case "code":
          return b.text;
        case "rule":
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

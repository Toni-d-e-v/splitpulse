import React, { Fragment } from "react";

/**
 * Tiny block + inline markdown renderer for chat bubbles.
 * Handles paragraphs, line breaks, bullet/numbered lists, **bold**,
 * *italic*, `inline code`, and [links](https://example).
 *
 * Deliberately not a full CommonMark parser — keeps bundle size flat
 * and matches what Haiku tends to produce for short Pulse replies.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </>
  );
}

type BlockType =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function splitBlocks(text: string): BlockType[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockType[] = [];
  let buffer: BlockType | null = null;

  const flush = () => {
    if (buffer) blocks.push(buffer);
    buffer = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.trim() === "") {
      flush();
      continue;
    }

    const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (ulMatch) {
      if (buffer?.kind !== "ul") {
        flush();
        buffer = { kind: "ul", items: [] };
      }
      buffer.items.push(ulMatch[1]);
      continue;
    }

    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (buffer?.kind !== "ol") {
        flush();
        buffer = { kind: "ol", items: [] };
      }
      buffer.items.push(olMatch[1]);
      continue;
    }

    if (buffer?.kind !== "p") {
      flush();
      buffer = { kind: "p", lines: [] };
    }
    buffer.lines.push(line);
  }
  flush();
  return blocks;
}

function Block({ block }: { block: BlockType }) {
  if (block.kind === "ul") {
    return (
      <ul className="my-1 list-disc space-y-0.5 pl-5 marker:text-white/35">
        {block.items.map((item, index) => (
          <li key={index}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "ol") {
    return (
      <ol className="my-1 list-decimal space-y-0.5 pl-5 marker:text-white/35">
        {block.items.map((item, index) => (
          <li key={index}>
            <Inline text={item} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p className="my-1 first:mt-0 last:mb-0">
      {block.lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          <Inline text={line} />
        </Fragment>
      ))}
    </p>
  );
}

const INLINE_REGEX =
  /(\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/;

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(INLINE_REGEX);
    if (!match) {
      parts.push(remaining);
      break;
    }
    const start = match.index ?? 0;
    if (start > 0) parts.push(remaining.slice(0, start));
    const [, , bold1, bold2, code, italic1, italic2, linkText, linkUrl] = match;

    if (bold1 ?? bold2) {
      parts.push(
        <strong key={key++} className="font-bold text-white">
          {bold1 ?? bold2}
        </strong>,
      );
    } else if (code) {
      parts.push(
        <code
          key={key++}
          className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.85em] font-mono text-white"
        >
          {code}
        </code>,
      );
    } else if (italic1 ?? italic2) {
      parts.push(
        <em key={key++} className="italic">
          {italic1 ?? italic2}
        </em>,
      );
    } else if (linkText && linkUrl) {
      parts.push(
        <a
          key={key++}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent-primary)] underline-offset-2 hover:underline"
        >
          {linkText}
        </a>,
      );
    }

    remaining = remaining.slice(start + match[0].length);
  }

  return <>{parts}</>;
}

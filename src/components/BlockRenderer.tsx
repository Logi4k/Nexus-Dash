import type { NoteBlock } from "@/types";
import type { PageTheme } from "@/lib/theme";

interface Props {
  block: NoteBlock;
  blockIndex: number;
  theme: PageTheme;
  onChange: (content: string, extra?: Partial<NoteBlock>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
  autoFocus?: boolean;
}

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  outline: "none",
  color: "var(--tx-1)",
  resize: "none",
  fontFamily: "inherit",
  textAlign: "left",
  direction: "ltr",
  unicodeBidi: "plaintext",
};

interface TextAreaProps {
  value: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
}

function TextArea({
  value,
  autoFocus,
  style,
  placeholder = "Type something...",
  onChange,
  onKeyDown,
  onFocus,
}: TextAreaProps) {
  return (
    <textarea
      autoFocus={autoFocus}
      dir="ltr"
      value={value}
      rows={1}
      placeholder={placeholder}
      style={{ ...baseInputStyle, ...style }}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
      onFocus={onFocus}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
}

export default function BlockRenderer({ block, blockIndex, theme, onChange, onKeyDown, onFocus, autoFocus }: Props) {
  const bodyStyle: React.CSSProperties = {
    fontSize: 15,
    lineHeight: 1.75,
    color: "var(--tx-2)",
  };

  switch (block.type) {
    case "h1":
      return (
        <TextArea
          value={block.content}
          autoFocus={autoFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ fontSize: 31, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.04em", color: "var(--tx-1)" }}
          placeholder="Heading 1"
        />
      );

    case "h2":
      return (
        <TextArea
          value={block.content}
          autoFocus={autoFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.03em", color: "var(--tx-1)" }}
          placeholder="Heading 2"
        />
      );

    case "h3":
      return (
        <TextArea
          value={block.content}
          autoFocus={autoFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, color: "var(--tx-1)" }}
          placeholder="Heading 3"
        />
      );

    case "bullet":
      return (
        <div className="flex gap-3 items-start">
          <span className="mt-[11px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={bodyStyle}
            placeholder="List item"
          />
        </div>
      );

    case "numbered":
      return (
        <div className="flex gap-3 items-start">
          <span className="mt-[3px] text-[13px] font-semibold flex-shrink-0 w-6 text-right" style={{ color: "var(--tx-4)" }}>
            {blockIndex + 1}.
          </span>
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={bodyStyle}
            placeholder="List item"
          />
        </div>
      );

    case "todo":
      return (
        <div className="flex gap-3 items-start">
          <button
            className="mt-[5px] w-4.5 h-4.5 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-all"
            style={
              block.checked
                ? { background: theme.accent, border: `1px solid ${theme.accent}` }
                : { border: "1px solid rgba(var(--border-rgb),0.2)", background: "rgba(var(--surface-rgb),0.03)" }
            }
            onClick={() => onChange(block.content, { checked: !block.checked })}
          >
            {block.checked && <span className="text-[9px] font-black" style={{ color: "#070810" }}>OK</span>}
          </button>
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={{
              ...bodyStyle,
              color: block.checked ? "var(--tx-4)" : bodyStyle.color,
              textDecoration: block.checked ? "line-through" : "none",
            }}
            placeholder="To-do"
          />
        </div>
      );

    case "quote":
      return (
        <div className="pl-4" style={{ borderLeft: "2px solid rgba(var(--border-rgb),0.14)" }}>
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={{ ...bodyStyle, fontStyle: "italic", color: "var(--tx-3)" }}
            placeholder="Quote"
          />
        </div>
      );

    case "callout":
      return (
        <div
          className="flex gap-3 items-start px-4 py-3 rounded-2xl"
          style={{ background: "rgba(var(--surface-rgb),0.04)", border: `1px solid ${theme.border}` }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
            Note
          </span>
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={bodyStyle}
            placeholder="Callout"
          />
        </div>
      );

    case "code":
      return (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-base)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
          <div className="px-4 py-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--tx-4)", borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}>
            {block.language || "Code"}
          </div>
          <TextArea
            value={block.content}
            autoFocus={autoFocus}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--color-profit)",
              fontFamily: "'JetBrains Mono', monospace",
              padding: "14px 16px",
            }}
            placeholder="// code"
          />
        </div>
      );

    case "divider":
      return (
        <div className="py-3">
          <div className="w-full h-px" style={{ background: "rgba(var(--border-rgb),0.08)" }} />
        </div>
      );

    case "image":
      return (
        <div
          className="flex items-center justify-center px-6 py-12 rounded-2xl"
          style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px dashed rgba(var(--border-rgb),0.12)" }}
        >
          <span className="text-[12px]" style={{ color: "var(--tx-4)" }}>
            Image placeholder
          </span>
        </div>
      );

    case "link-bookmark":
      return (
        <div className="px-4 py-3 rounded-2xl" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
          {block.meta?.title ? (
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--tx-1)" }}>{block.meta.title}</div>
              {block.meta.description && (
                <div className="text-[12px] mt-1" style={{ color: "var(--tx-4)" }}>
                  {block.meta.description}
                </div>
              )}
              <div className="text-[11px] mt-2" style={{ color: theme.accent }}>
                {block.content}
              </div>
            </div>
          ) : (
            <TextArea
              value={block.content}
              autoFocus={autoFocus}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              style={{ ...bodyStyle, color: theme.accent }}
              placeholder="Paste a URL"
            />
          )}
        </div>
      );

    default:
      return (
        <TextArea
          value={block.content}
          autoFocus={autoFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={bodyStyle}
          placeholder="Type '/' for commands..."
        />
      );
  }
}

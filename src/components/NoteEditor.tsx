import { useMemo, useState } from "react";
import { ArrowLeft, Columns2, GripVertical, Hash, Plus, Sparkles, Trash2, X, ChevronUp, ChevronDown, ListTodo, Heading1, Heading2, Type, List, Quote, Code2 } from "lucide-react";
import BlockRenderer from "@/components/BlockRenderer";
import type { IdeaNote, NoteBlock, NoteBlockType } from "@/types";
import type { PageTheme } from "@/lib/theme";

const BLOCK_TYPES: { type: NoteBlockType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "h1", label: "H1" },
  { type: "h2", label: "H2" },
  { type: "bullet", label: "Bullet" },
  { type: "todo", label: "Todo" },
  { type: "quote", label: "Quote" },
  { type: "code", label: "Code" },
];

interface Props {
  note: IdeaNote;
  theme: PageTheme;
  onUpdate: (patch: Partial<IdeaNote>) => void;
  onBack: () => void;
  zenMode?: boolean;
  allowZenMode?: boolean;
  onToggleZenMode?: () => void;
}

export default function NoteEditor({
  note,
  theme,
  onUpdate,
  onBack,
  zenMode = false,
  allowZenMode = true,
  onToggleZenMode,
}: Props) {
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(note.blocks[0]?.id ?? null);

  function newId() {
    return crypto.randomUUID();
  }

  function updateBlocks(blocks: NoteBlock[]) {
    onUpdate({ blocks });
  }

  function updateBlock(id: string, content: string, extra?: Partial<NoteBlock>) {
    if (content === "/") {
      setSlashMenu({ blockId: id, query: "" });
    } else if (slashMenu?.blockId === id) {
      if (content === "" || content.endsWith(" ")) {
        setSlashMenu(null);
      } else {
        setSlashMenu({ blockId: id, query: content.slice(1) });
      }
    } else {
      setSlashMenu(null);
    }

    updateBlocks(note.blocks.map((block) => (block.id === id ? { ...block, content, ...extra } : block)));
  }

  function insertBlock(afterId: string, type: NoteBlockType = "text") {
    const newBlock: NoteBlock = { id: newId(), type, content: "" };
    const idx = note.blocks.findIndex((block) => block.id === afterId);
    const updated = [...note.blocks];
    updated.splice(idx + 1, 0, newBlock);
    updateBlocks(updated);
    setFocusedBlockId(newBlock.id);
    setSlashMenu(null);
  }

  function replaceBlockType(id: string, type: NoteBlockType) {
    updateBlocks(note.blocks.map((block) => (block.id === id ? { ...block, type, content: "" } : block)));
    setSlashMenu(null);
    setFocusedBlockId(id);
  }

  function moveBlock(id: string, direction: "up" | "down") {
    const index = note.blocks.findIndex((block) => block.id === id);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= note.blocks.length) return;

    const updated = [...note.blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateBlocks(updated);
    setFocusedBlockId(id);
  }

  function deleteBlock(id: string) {
    if (note.blocks.length <= 1) return;
    const idx = note.blocks.findIndex((block) => block.id === id);
    const updated = note.blocks.filter((block) => block.id !== id);
    updateBlocks(updated);
    setFocusedBlockId(updated[Math.max(0, idx - 1)]?.id ?? null);
  }

  function handleKeyDown(blockId: string, e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertBlock(blockId);
    }
    if (e.key === "Backspace") {
      const block = note.blocks.find((item) => item.id === blockId);
      if (block?.content === "") {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
    if (e.key === "Escape") {
      setSlashMenu(null);
    }
  }

  function addTag() {
    const nextTag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!nextTag || note.tags.includes(nextTag)) {
      setTagInput("");
      setAddingTag(false);
      return;
    }
    onUpdate({ tags: [...note.tags, nextTag] });
    setTagInput("");
    setAddingTag(false);
  }

  const filteredSlashItems = useMemo(
    () =>
      slashMenu
        ? BLOCK_TYPES.filter((item) => item.label.toLowerCase().includes(slashMenu.query.toLowerCase()))
        : [],
    [slashMenu]
  );

  const canShowZenToggle = Boolean(allowZenMode && onToggleZenMode && note.blocks.length > 0);
  const mobileQuickBlocks: { label: string; icon: typeof Type; type: NoteBlockType }[] = [
    { label: "Text", icon: Type, type: "text" },
    { label: "H2", icon: Heading2, type: "h2" },
    { label: "List", icon: List, type: "bullet" },
    { label: "Todo", icon: ListTodo, type: "todo" },
    { label: "H1", icon: Heading1, type: "h1" },
    { label: "Quote", icon: Quote, type: "quote" },
    { label: "Code", icon: Code2, type: "code" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}>
        <button onClick={onBack} className="md:hidden flex-shrink-0">
          <ArrowLeft size={16} style={{ color: "var(--tx-3)" }} />
        </button>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--tx-4)" }}>
          <Sparkles size={12} />
          Document
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canShowZenToggle && (
            <button
              type="button"
              onClick={onToggleZenMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={
                zenMode
                  ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
                  : { background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--tx-3)" }
              }
            >
              <Columns2 size={13} />
              {zenMode ? "Show panels" : "Zen mode"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className="md:hidden sticky top-0 z-20 px-4 py-1.5"
          style={{
            background: "linear-gradient(180deg, rgba(var(--bg-card-rgb),0.98) 0%, rgba(var(--bg-card-rgb),0.92) 100%)",
            borderBottom: "1px solid rgba(var(--border-rgb),0.06)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {mobileQuickBlocks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => focusedBlockId && insertBlock(focusedBlockId, item.type)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold whitespace-nowrap"
                    style={{ background: "rgba(var(--surface-rgb),0.05)", color: "var(--tx-2)" }}
                  >
                    <Icon size={12} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => focusedBlockId && insertBlock(focusedBlockId)}
              className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
              title="Add block"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className={zenMode ? "w-full max-w-none px-4 pb-28 pt-6 md:px-12 md:pb-12 md:pt-12 lg:px-20 relative" : "w-full max-w-[1040px] mr-auto px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-12 lg:px-14 relative"}>
          <div className="mb-8">
            <input
              value={note.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Untitled"
              className="w-full bg-transparent outline-none text-[30px] md:text-[50px] font-black tracking-[-0.05em] leading-[1.02]"
              style={{ color: "var(--tx-1)" }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {note.tags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
                >
                  #{tag}
                  <button onClick={() => onUpdate({ tags: note.tags.filter((item) => item !== tag) })}>
                    <X size={10} />
                  </button>
                </div>
              ))}

              {addingTag ? (
                <input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag();
                    if (e.key === "Escape") {
                      setTagInput("");
                      setAddingTag(false);
                    }
                  }}
                  onBlur={addTag}
                  placeholder="tag"
                  className="px-2.5 py-1 rounded-full text-[11px] outline-none w-24"
                  style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
                />
              ) : (
                <button
                  onClick={() => setAddingTag(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all"
                  style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px dashed rgba(var(--border-rgb),0.1)", color: "var(--tx-4)" }}
                >
                  <Hash size={10} />
                  Add tag
                </button>
              )}
            </div>

            <div className="mt-6 hidden md:flex flex-wrap items-center gap-2">
              {BLOCK_TYPES.map((item) => (
                <button
                  key={item.type}
                  onClick={() => focusedBlockId && insertBlock(focusedBlockId, item.type)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all"
                  style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.07)", color: "var(--tx-3)" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 relative">
            {note.blocks.map((block, index) => (
              <div key={block.id} className="group relative">
                <div className="absolute -left-9 top-1 hidden md:flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => insertBlock(block.id)}
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: "rgba(var(--surface-rgb),0.04)", color: "var(--tx-3)" }}
                    title="Add block"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <div className="flex items-start gap-2">
                  <div className="hidden md:flex w-6 pt-2 justify-center">
                    <div
                      className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--tx-4)" }}
                    >
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, "up")}
                        disabled={index === 0}
                        className="w-5 h-5 rounded-md flex items-center justify-center disabled:opacity-30"
                        style={{ background: "rgba(var(--surface-rgb),0.025)" }}
                        title="Move up"
                      >
                        <ChevronUp size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, "down")}
                        disabled={index === note.blocks.length - 1}
                        className="w-5 h-5 rounded-md flex items-center justify-center disabled:opacity-30"
                        style={{ background: "rgba(var(--surface-rgb),0.025)" }}
                        title="Move down"
                      >
                        <ChevronDown size={10} />
                      </button>
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ background: "rgba(var(--surface-rgb),0.025)" }}
                        title="Block handle"
                      >
                        <GripVertical size={10} />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteBlock(block.id)}
                        disabled={note.blocks.length <= 1}
                        className="w-5 h-5 rounded-md flex items-center justify-center disabled:opacity-30"
                        style={{ background: "rgba(239,68,68,0.06)", color: "#f87171" }}
                        title="Delete block"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <BlockRenderer
                      block={block}
                      blockIndex={index}
                      theme={theme}
                      onChange={(content, extra) => updateBlock(block.id, content, extra)}
                      onKeyDown={(e) => handleKeyDown(block.id, e)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      autoFocus={focusedBlockId === block.id}
                    />

                    {focusedBlockId === block.id && (
                      <div className="md:hidden flex items-center gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => insertBlock(block.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(var(--surface-rgb),0.04)", color: "var(--tx-2)" }}
                          title="Add block"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(block.id, "up")}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                          style={{ background: "rgba(var(--surface-rgb),0.04)", color: "var(--tx-2)" }}
                          title="Move up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(block.id, "down")}
                          disabled={index === note.blocks.length - 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                          style={{ background: "rgba(var(--surface-rgb),0.04)", color: "var(--tx-2)" }}
                          title="Move down"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBlock(block.id)}
                          disabled={note.blocks.length <= 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}
                          title="Delete block"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {slashMenu && filteredSlashItems.length > 0 && (
              <div
                className="absolute z-50 rounded-2xl overflow-hidden shadow-xl"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid rgba(var(--border-rgb),0.08)",
                  minWidth: 220,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {filteredSlashItems.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => replaceBlockType(slashMenu.blockId, item.type)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-all"
                    style={{ color: "var(--tx-2)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(var(--surface-rgb),0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="text-[13px] font-medium">{item.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
                      /
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

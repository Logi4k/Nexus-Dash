import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Columns2, GripVertical, Hash, Mic, Plus, Trash2, X, ChevronUp, ChevronDown, ListTodo, Heading1, Heading2, Type, List, Quote, Code2 } from "lucide-react";
import BlockRenderer from "@/components/BlockRenderer";
import type { IdeaNote, NoteBlock, NoteBlockType } from "@/types";
import type { PageTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const BLOCK_TYPES: { type: NoteBlockType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "h1", label: "H1" },
  { type: "h2", label: "H2" },
  { type: "bullet", label: "Bullet" },
  { type: "numbered", label: "Numbered" },
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
  saveState?: "saved" | "saving" | "dirty";
}

export default function NoteEditor({
  note,
  theme,
  onUpdate,
  onBack,
  zenMode = false,
  allowZenMode = true,
  onToggleZenMode,
  saveState = "saved",
}: Props) {
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(note.blocks[0]?.id ?? null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(note.blocks[0]?.id ?? null);
  const [isDictating, setIsDictating] = useState(false);
  // Use refs for drag state — refs are synchronous and available immediately in drag event closures
  const draggedIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = useMemo(() => {
    const text = note.blocks.map((b) => b.content).join(" ");
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [note.blocks]);

  const lastSavedLabel = useMemo(() => {
    if (!note.updatedAt) return "";
    const d = new Date(note.updatedAt);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }, [note.updatedAt]);

  useEffect(() => {
    const firstBlockId = note.blocks[0]?.id ?? null;
    setFocusedBlockId(firstBlockId);
    setPendingFocusId(firstBlockId);
    setSlashMenu(null);
  }, [note.id]);

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

  function insertBlock(afterId: string, type: NoteBlockType = "text", extra?: Partial<NoteBlock>) {
    const newBlock: NoteBlock = { id: newId(), type, content: "", ...extra };
    const idx = note.blocks.findIndex((block) => block.id === afterId);
    const updated = [...note.blocks];
    updated.splice(idx + 1, 0, newBlock);
    updateBlocks(updated);
    setFocusedBlockId(newBlock.id);
    setPendingFocusId(newBlock.id);
    setSlashMenu(null);
  }

  function insertImageBlock(dataUrl: string) {
    const targetId = focusedBlockId ?? note.blocks[note.blocks.length - 1]?.id ?? null;
    if (!targetId) return;
    const newBlock: NoteBlock = { id: newId(), type: "image", content: dataUrl };
    const idx = note.blocks.findIndex((block) => block.id === targetId);
    const updated = [...note.blocks];
    updated.splice(Math.max(0, idx) + 1, 0, newBlock);
    updateBlocks(updated);
    setFocusedBlockId(newBlock.id);
    setPendingFocusId(newBlock.id);
  }

  function replaceBlockType(id: string, type: NoteBlockType) {
    updateBlocks(
      note.blocks.map((block) =>
        block.id === id
          ? { ...block, type, content: "", checked: type === "todo" ? false : undefined }
          : block
      )
    );
    setSlashMenu(null);
    setFocusedBlockId(id);
    setPendingFocusId(id);
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
    setPendingFocusId(id);
  }

  function moveBlockTo(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const fromIndex = note.blocks.findIndex((b) => b.id === draggedId);
    const toIndex = note.blocks.findIndex((b) => b.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const updated = [...note.blocks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updateBlocks(updated);
    setFocusedBlockId(draggedId);
    setPendingFocusId(draggedId);
  }

  function deleteBlock(id: string) {
    if (note.blocks.length <= 1) return;
    const idx = note.blocks.findIndex((block) => block.id === id);
    const updated = note.blocks.filter((block) => block.id !== id);
    updateBlocks(updated);
    const nextFocusedId = updated[Math.max(0, idx - 1)]?.id ?? null;
    setFocusedBlockId(nextFocusedId);
    setPendingFocusId(nextFocusedId);
  }

  function handleKeyDown(blockId: string, e: React.KeyboardEvent<HTMLElement>) {
    const block = note.blocks.find((item) => item.id === blockId);
    if (!block) return;
    const createSectionShortcut = e.ctrlKey || e.metaKey;
    const listBlock = block.type === "bullet" || block.type === "numbered" || block.type === "todo";

    if (e.key === "Enter") {
      if (createSectionShortcut) {
        e.preventDefault();
        insertBlock(blockId);
        return;
      }

      if (!listBlock || e.shiftKey) {
        return;
      }

      e.preventDefault();
      const content = block.content.trim();

      if (content === "") {
        updateBlocks(
          note.blocks.map((item) =>
            item.id === blockId ? { ...item, type: "text", checked: undefined } : item
          )
        );
        setFocusedBlockId(blockId);
        setPendingFocusId(blockId);
        setSlashMenu(null);
        return;
      }

      if (block.type === "todo") {
        insertBlock(blockId, "todo", { checked: false });
        return;
      }

      if (block.type === "bullet" || block.type === "numbered") {
        insertBlock(blockId, block.type);
        return;
      }
    }
    if (e.key === "Backspace") {
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
    { label: "1.", icon: List, type: "numbered" },
    { label: "Todo", icon: ListTodo, type: "todo" },
    { label: "H1", icon: Heading1, type: "h1" },
    { label: "Quote", icon: Quote, type: "quote" },
    { label: "Code", icon: Code2, type: "code" },
  ];

  function handleCameraFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        insertImageBlock(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleDictation() {
    const SpeechRecognitionCtor =
      (window as Window & {
        webkitSpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
        };
        SpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
        };
      }).SpeechRecognition ??
      (window as Window & {
        webkitSpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
        };
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      onUpdate({
        title: note.title.trim()
          ? note.title
          : "Voice notes require a supported browser",
      });
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsDictating(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      const targetId = focusedBlockId ?? note.blocks[0]?.id;
      if (!targetId) return;
      const targetBlock = note.blocks.find((block) => block.id === targetId);
      if (!targetBlock) return;
      const nextContent = targetBlock.content.trim()
        ? `${targetBlock.content}\n${transcript}`
        : transcript;
      updateBlock(targetId, nextContent);
    };
    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);
    recognition.start();
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      <div className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}>
        <button onClick={onBack} className="md:hidden flex-shrink-0 p-1">
          <ArrowLeft size={14} style={{ color: "var(--tx-3)" }} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-tx-4 hidden md:inline">{wordCount} {wordCount === 1 ? "word" : "words"}</span>
          <span className="text-[10px] text-tx-4 hidden md:inline" style={{ color: saveState === "dirty" ? theme.accent : "var(--tx-4)" }}>
            {lastSavedLabel ? `${lastSavedLabel} · ` : ""}{saveState === "saving" ? "Saving" : saveState === "dirty" ? "Unsaved" : "Saved"}
          </span>
          <button
            type="button"
            onClick={handleDictation}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all"
            style={{
              background: isDictating ? "color-mix(in srgb, var(--color-profit) 12%, transparent)" : "rgba(var(--surface-rgb),0.05)",
              border: `1px solid ${isDictating ? "rgba(var(--color-profit-rgb),0.26)" : "rgba(var(--border-rgb),0.08)"}`,
              color: isDictating ? "var(--color-profit)" : "var(--tx-3)",
            }}
          >
            <Mic size={12} />
            {isDictating ? "Listening" : "Dictate"}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all"
            style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--tx-3)" }}
          >
            <Camera size={12} />
            Add image
          </button>
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraFileChange}
      />

      <div className="flex-1 overflow-y-auto">
        <div
          className="md:hidden sticky top-0 z-[var(--z-sticky)] px-5 py-1.5"
          style={{
            background: "linear-gradient(180deg, rgba(var(--bg-card-rgb),0.98) 0%, rgba(var(--bg-card-rgb),0.92) 100%)",
            borderBottom: "1px solid rgba(var(--border-rgb),0.06)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {mobileQuickBlocks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => focusedBlockId && insertBlock(focusedBlockId, item.type)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold whitespace-nowrap"
                    style={{ background: "rgba(var(--surface-rgb),0.05)", color: "var(--tx-2)" }}
                  >
                    <Icon size={10} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => focusedBlockId && insertBlock(focusedBlockId)}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto"
              style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
              title="Add block"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className={zenMode ? "w-full max-w-none px-6 pb-28 pt-6 md:px-12 md:pb-12 lg:px-20 relative" : "w-full max-w-[1300px] mx-auto px-6 pb-28 pt-6 md:px-10 md:pb-12 md:pt-8 lg:px-16 relative"}>
          <div className="border-b" style={{ borderColor: "rgba(var(--border-rgb),0.06)" }}>
          <div className="px-1 pt-5 pb-5">
            <input
              value={note.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Untitled"
              className="w-full bg-transparent outline-none text-[20px] md:text-[24px] font-black tracking-[-0.03em] leading-[1.15]"
              style={{ color: "var(--tx-1)" }}
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
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

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium tracking-wide" style={{ color: "var(--tx-4)" }}>
              <span>Enter = new line</span>
              <span className="opacity-40">·</span>
              <span>Ctrl+Enter = new section</span>
            </div>

            <div className="mt-3 hidden md:flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => focusedBlockId && insertBlock(focusedBlockId)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all"
                style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
              >
                New section
              </button>
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
          </div>

          <div className="space-y-0.5 relative px-4 pt-2 pb-8 md:pt-3 md:pb-10">
            {note.blocks.map((block, index) => (
              <div
                key={block.id}
                className={cn("group relative", draggedIdRef.current === block.id && "opacity-40")}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", block.id);
                  draggedIdRef.current = block.id;
                }}
                onDragEnd={() => { draggedIdRef.current = null; setDragOverId(null); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedIdRef.current && draggedIdRef.current !== block.id) {
                    setDragOverId(block.id);
                    e.dataTransfer.dropEffect = "move";
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = draggedIdRef.current;
                  if (draggedId && draggedId !== block.id) {
                    moveBlockTo(draggedId, block.id);
                  }
                  draggedIdRef.current = null;
                  setDragOverId(null);
                }}
                style={dragOverId === block.id ? { outline: "1px dashed rgba(var(--accent-rgb),0.5)", borderRadius: "6px" } : undefined}
              >
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
                        className="w-5 h-5 rounded-md flex items-center justify-center cursor-grab active:cursor-grabbing"
                        style={{ background: "rgba(var(--surface-rgb),0.025)" }}
                        title="Drag to reorder"
                      >
                        <GripVertical size={10} />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteBlock(block.id)}
                        disabled={note.blocks.length <= 1}
                        className="w-5 h-5 rounded-md flex items-center justify-center disabled:opacity-30"
                        style={{ background: "rgba(184,64,64,0.06)", color: "var(--color-loss)" }}
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
                      onFocus={() => {
                        setFocusedBlockId(block.id);
                        if (pendingFocusId === block.id) setPendingFocusId(null);
                      }}
                      autoFocus={pendingFocusId === block.id}
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
                          style={{ background: "rgba(184,64,64,0.08)", color: "var(--color-loss)" }}
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
                className="absolute z-[var(--z-picker)] rounded-2xl overflow-hidden shadow-xl"
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

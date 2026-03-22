import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, FolderPen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/store";
import { PAGE_THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import NoteEditor from "@/components/NoteEditor";
import type { IdeaNote, IdeaTopic } from "@/types";
import type { AppData } from "@/types";

const theme = PAGE_THEMES.ideas;

const DEFAULT_TOPICS: IdeaTopic[] = [
  { id: "t1", name: "AI Research", emoji: "AI" },
  { id: "t2", name: "Trading Strategies", emoji: "TS" },
  { id: "t3", name: "Market Analysis", emoji: "MA" },
  { id: "t4", name: "Book Notes", emoji: "BN" },
];

function NoteDeleteButton({
  pending,
  onRequest,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pending) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRequest();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-all"
      >
        Delete
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.05] text-tx-3 hover:text-tx-1 transition-all"
      >
        No
      </button>
    </div>
  );
}

function TopicDeleteButton({
  pending,
  onRequest,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pending) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRequest();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-all"
      >
        Delete
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.05] text-tx-3 hover:text-tx-1 transition-all"
      >
        No
      </button>
    </div>
  );
}

export default function Ideas() {
  const { data, update } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const topics = data.ideaTopics ?? DEFAULT_TOPICS;
  const notes = data.ideaNotes ?? [];
  const handledLocationAction = useRef<string | null>(null);

  const [activeTopicId, setActiveTopicId] = useState<string>(topics[0]?.id ?? "");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [topicDeleteConfirmId, setTopicDeleteConfirmId] = useState<string | null>(null);
  const [noteDeleteConfirmId, setNoteDeleteConfirmId] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [mobileView, setMobileView] = useState<"topics" | "notes" | "editor">("topics");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth < 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (isMobile && zenMode) {
      setZenMode(false);
    }
  }, [isMobile, zenMode]);

  useEffect(() => {
    if (!topics.some((topic) => topic.id === activeTopicId)) {
      setActiveTopicId(topics[0]?.id ?? "");
    }
  }, [topics, activeTopicId]);

  useEffect(() => {
    const action = (location.state as { action?: string } | null)?.action;
    if (!action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === action) return;
    if (action === "addNote" && activeTopicId) {
      handledLocationAction.current = action;
      const note: IdeaNote = {
        id: newId(),
        topicId: activeTopicId,
        title: "Untitled",
        blocks: [{ id: newId(), type: "text", content: "" }],
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      update((d: AppData) => ({ ...d, ideaNotes: [note, ...(d.ideaNotes ?? [])] }));
      setActiveNoteId(note.id);
      setMobileView("editor");
      setNoteDeleteConfirmId(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [activeTopicId, location.pathname, location.state, navigate, update]);

  const topicNotes = useMemo(
    () =>
      notes
        .filter((note) => note.topicId === activeTopicId)
        .filter((note) => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          const content = note.blocks.map((block) => block.content).join(" ").toLowerCase();
          return note.title.toLowerCase().includes(q) || content.includes(q);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes, activeTopicId, search]
  );

  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null;
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? null;
  const isZenActive = !isMobile && zenMode && Boolean(activeNote);
  const showSidePanels = !isZenActive;
  const showEditorPane = Boolean(activeNote);

  function newId() {
    return crypto.randomUUID();
  }

  function beginTopicEdit(topic: IdeaTopic) {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setTopicDeleteConfirmId(null);
  }

  function saveTopicName(topicId: string) {
    const nextName = editingTopicName.trim();
    setEditingTopicId(null);
    setEditingTopicName("");
    if (!nextName) return;

    update((d: AppData) => ({
      ...d,
      ideaTopics: (d.ideaTopics ?? DEFAULT_TOPICS).map((topic: IdeaTopic) =>
        topic.id === topicId ? { ...topic, name: nextName } : topic
      ),
    }));
  }

  function createTopic() {
    if (!newTopicName.trim()) return;
    const topic: IdeaTopic = { id: newId(), name: newTopicName.trim(), emoji: "+" };
    update((d: AppData) => ({ ...d, ideaTopics: [...(d.ideaTopics ?? DEFAULT_TOPICS), topic] }));
    setActiveTopicId(topic.id);
    setNewTopicName("");
    setAddingTopic(false);
    setMobileView(isMobile ? "notes" : "notes");
  }

  function deleteTopic(id: string) {
    const remainingTopics = topics.filter((topic) => topic.id !== id);
    const nextTopicId = remainingTopics[0]?.id ?? "";

    update((d: AppData) => ({
      ...d,
      ideaTopics: (d.ideaTopics ?? DEFAULT_TOPICS).filter((topic: IdeaTopic) => topic.id !== id),
      ideaNotes: (d.ideaNotes ?? []).filter((note: IdeaNote) => note.topicId !== id),
    }));

    if (activeTopicId === id) {
      setActiveTopicId(nextTopicId);
      setActiveNoteId(null);
      setZenMode(false);
      setMobileView(nextTopicId ? "notes" : "topics");
    }

    setTopicDeleteConfirmId(null);
  }

  function createNote() {
    if (!activeTopicId) return;

    const note: IdeaNote = {
      id: newId(),
      topicId: activeTopicId,
      title: "Untitled",
      blocks: [{ id: newId(), type: "text", content: "" }],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    update((d: AppData) => ({ ...d, ideaNotes: [note, ...(d.ideaNotes ?? [])] }));
    setActiveNoteId(note.id);
    setMobileView("editor");
    setNoteDeleteConfirmId(null);
  }

  function updateNote(id: string, patch: Partial<IdeaNote>) {
    update((d: AppData) => ({
      ...d,
      ideaNotes: (d.ideaNotes ?? []).map((note: IdeaNote) =>
        note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
      ),
    }));
  }

  function deleteNote(id: string) {
    update((d: AppData) => ({ ...d, ideaNotes: (d.ideaNotes ?? []).filter((note: IdeaNote) => note.id !== id) }));
    if (activeNoteId === id) {
      setActiveNoteId(null);
      setMobileView("notes");
      setZenMode(false);
    }
    setNoteDeleteConfirmId(null);
  }

  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] flex flex-col">
      <div className={cn("hidden md:block mb-5", isZenActive && "md:hidden")}>
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>
          Ideas
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "#f8fafc", letterSpacing: "-0.03em" }}>
          Research & Brainstorm
        </h1>
      </div>

      <div
        className={cn(
          "flex flex-1 min-h-0 overflow-hidden",
          isMobile ? "rounded-none" : isZenActive ? "rounded-[20px]" : "rounded-[28px]"
        )}
        style={{
          background: "#090b12",
          border: isZenActive ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <aside
          className={cn(
            "border-r min-h-0",
            mobileView === "topics" ? "block w-full" : "hidden",
            showSidePanels ? "md:block" : "md:hidden",
            "md:w-[250px]"
          )}
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0d1018" }}
        >
          <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.42)" }}>
              <FolderPen size={12} />
              Workspace
            </div>
            <div className="mt-3 relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.28)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages..."
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-[12px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#f8fafc" }}
              />
            </div>
          </div>

          <div className="p-3 space-y-1 overflow-y-auto h-full">
            {topics.map((topic) => {
              const topicCount = notes.filter((note) => note.topicId === topic.id).length;
              const isActive = topic.id === activeTopicId;
              const isEditing = editingTopicId === topic.id;
              const isDeletePending = topicDeleteConfirmId === topic.id;

              return (
                <div
                  key={topic.id}
                  className="group rounded-2xl px-3 py-3 transition-all cursor-pointer"
                  style={
                    isActive
                      ? { background: "rgba(255,255,255,0.06)", border: `1px solid ${theme.border}` }
                      : { border: "1px solid transparent" }
                  }
                  onClick={() => {
                    if (isEditing) return;
                    setActiveTopicId(topic.id);
                    setActiveNoteId(null);
                    setMobileView("notes");
                    setZenMode(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", color: isActive ? theme.accent : "rgba(255,255,255,0.68)" }}
                    >
                      {topic.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingTopicName}
                          onChange={(e) => setEditingTopicName(e.target.value)}
                          onBlur={() => saveTopicName(topic.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTopicName(topic.id);
                            if (e.key === "Escape") {
                              setEditingTopicId(null);
                              setEditingTopicName("");
                            }
                          }}
                          className="w-full rounded-lg px-2 py-1 text-[13px] font-semibold outline-none"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc" }}
                        />
                      ) : (
                        <div className="text-[13px] font-semibold truncate" style={{ color: isActive ? "#f8fafc" : "rgba(255,255,255,0.75)" }}>
                          {topic.name}
                        </div>
                      )}
                      <div className="text-[11px] mt-0.5" style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.3)" }}>
                        {topicCount} pages
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          beginTopicEdit(topic);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                      </button>
                      <TopicDeleteButton
                        pending={isDeletePending}
                        onRequest={() => setTopicDeleteConfirmId(topic.id)}
                        onConfirm={() => deleteTopic(topic.id)}
                        onCancel={() => setTopicDeleteConfirmId(null)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {addingTopic ? (
              <div className="px-2 pt-2">
                <input
                  autoFocus
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createTopic();
                    if (e.key === "Escape") setAddingTopic(false);
                  }}
                  className="w-full rounded-2xl px-3 py-2.5 text-[12px] outline-none"
                  placeholder="New space..."
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#f8fafc" }}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingTopic(true)}
                className="w-full mt-2 flex items-center gap-2 px-3 py-3 rounded-2xl text-[12px] font-medium transition-all"
                style={{ background: theme.dim, border: `1px dashed ${theme.border}`, color: theme.accent }}
              >
                <Plus size={13} />
                New space
              </button>
            )}
          </div>
        </aside>

        {activeTopic && (
        <section
          className={cn(
            "border-r min-h-0",
            mobileView === "notes" ? "block w-full" : "hidden",
            showSidePanels ? "md:block" : "md:hidden",
            "md:w-[320px]"
          )}
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0b0e16" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.36)" }}>
                  Pages
                </div>
                <div className="text-[17px] font-bold mt-1" style={{ color: "#f8fafc" }}>
                  {activeTopic.name}
                </div>
              </div>
              <button
                onClick={createNote}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold"
                style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
              >
                <Plus size={13} />
                New page
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2 overflow-y-auto h-full">
            {topicNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <BookOpen size={22} style={{ color: "rgba(255,255,255,0.2)" }} />
                <div className="mt-3 text-[13px]" style={{ color: "rgba(255,255,255,0.48)" }}>
                  No pages in this space yet.
                </div>
                <button onClick={createNote} className="mt-4 text-[12px] font-semibold" style={{ color: theme.accent }}>
                  Create your first page
                </button>
              </div>
            ) : (
              topicNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                const preview = note.blocks.map((block) => block.content).find(Boolean) ?? "Empty page";
                const isDeletePending = noteDeleteConfirmId === note.id;
                const dateLabel = new Date(note.updatedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                });

                return (
                  <div
                    key={note.id}
                    className="group rounded-2xl px-4 py-3 cursor-pointer transition-all"
                    style={
                      isActive
                        ? { background: "rgba(255,255,255,0.07)", border: `1px solid ${theme.border}` }
                        : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }
                    }
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setMobileView("editor");
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                        style={{ background: isActive ? theme.dim : "rgba(255,255,255,0.04)", color: isActive ? theme.accent : "rgba(255,255,255,0.55)" }}
                      >
                        Pg
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-semibold truncate" style={{ color: isActive ? "#f8fafc" : "rgba(255,255,255,0.75)" }}>
                            {note.title || "Untitled"}
                          </div>
                          <NoteDeleteButton
                            pending={isDeletePending}
                            onRequest={() => setNoteDeleteConfirmId(note.id)}
                            onConfirm={() => deleteNote(note.id)}
                            onCancel={() => setNoteDeleteConfirmId(null)}
                          />
                        </div>
                        <div className="text-[11px] mt-1 line-clamp-2" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {preview}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.24)" }}>
                            {dateLabel}
                          </span>
                          {note.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                              style={{ background: theme.dim, color: theme.accent }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
        )}

        {showEditorPane && activeNote && (
          <section className={cn("flex-1 min-w-0", mobileView === "editor" ? "block" : "hidden md:block")}>
            <NoteEditor
              note={activeNote}
              theme={theme}
              onUpdate={(patch) => updateNote(activeNote.id, patch)}
              onBack={() => {
                setMobileView("notes");
                setZenMode(false);
              }}
              zenMode={zenMode}
              allowZenMode={!isMobile}
              onToggleZenMode={() => setZenMode((current) => !current)}
            />
          </section>
        )}
      </div>
    </div>
  );
}

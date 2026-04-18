import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowLeft, BookOpen, FolderPen, Lightbulb, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/store";
import { getQuickActionState } from "@/lib/quickActions";
import { getViewIntentState } from "@/lib/viewIntents";
import { PAGE_THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useBWMode, bwPageTheme } from "@/lib/useBWMode";
import NoteEditor from "@/components/NoteEditor";
import { useRegisterPageView } from "@/components/PageViewContext";
import type { IdeaNote, IdeaTopic } from "@/types";
import type { AppData } from "@/types";

const DEFAULT_TOPICS: IdeaTopic[] = [
  { id: "t1", name: "AI Research", emoji: "AI" },
  { id: "t2", name: "Trading Strategies", emoji: "TS" },
  { id: "t3", name: "Market Analysis", emoji: "MA" },
  { id: "t4", name: "Book Notes", emoji: "BN" },
];

function cloneIdeaNote(note: IdeaNote): IdeaNote {
  return {
    ...note,
    tags: [...note.tags],
    blocks: note.blocks.map((block) => ({ ...block })),
  };
}

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
        className="md:opacity-0 md:group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} style={{ color: "var(--tx-4)" }} />
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
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-colors"
      >
        Delete
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold text-tx-3 hover:text-tx-1 transition-colors"
        style={{ background: "rgba(var(--surface-rgb),0.05)" }}
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
        className="md:opacity-0 md:group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} style={{ color: "var(--tx-4)" }} />
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
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-colors"
      >
        Delete
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold text-tx-3 hover:text-tx-1 transition-colors"
        style={{ background: "rgba(var(--surface-rgb),0.05)" }}
      >
        No
      </button>
    </div>
  );
}

export default function Ideas() {
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.ideas, isBW);
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const location = useLocation();
  const topics = data.ideaTopics && data.ideaTopics.length > 0 ? data.ideaTopics : DEFAULT_TOPICS;
  const notes = data.ideaNotes ?? [];
  const handledLocationAction = useRef<string | null>(null);
  const handledViewIntent = useRef<string | null>(null);

  const [activeTopicId, setActiveTopicId] = useState<string>(topics[0]?.id ?? "");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [topicDeleteConfirmId, setTopicDeleteConfirmId] = useState<string | null>(null);
  const [noteDeleteConfirmId, setNoteDeleteConfirmId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<IdeaNote | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  // Start on notes view if a topic exists (saves 1 tap on mobile)
  const [mobileView, setMobileView] = useState<"topics" | "notes" | "editor">(
    topics.length > 0 ? "notes" : "topics"
  );
  const [isMobile, setIsMobile] = useState(false);
  const [workspaceVisible, setWorkspaceVisible] = useState(true);
  const draftCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentView = useMemo(
    () => ({
      route: "/ideas",
      title: "Ideas workspace view",
      description: "Topic, note, and workspace search state",
      state: {
        search,
        activeTopicId,
        activeNoteId,
        mobileView,
      },
    }),
    [activeNoteId, activeTopicId, mobileView, search]
  );
  useRegisterPageView(currentView);

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth < 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!topics.some((topic) => topic.id === activeTopicId)) {
      setActiveTopicId(topics[0]?.id ?? "");
    }
  }, [topics, activeTopicId]);

  useEffect(() => {
    const quickAction = getQuickActionState(location.state);
    const requestKey = quickAction?.quickActionId ?? null;

    if (!quickAction?.action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === requestKey) return;
    if (quickAction.action === "addNote" && activeTopicId) {
      handledLocationAction.current = requestKey;
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
      if (!isMobile) setWorkspaceVisible(false);
    }
  }, [activeTopicId, isMobile, location.state, update]);

  useEffect(() => {
    const viewIntent = getViewIntentState(location.state);
    const requestKey = viewIntent?.id ?? null;

    if (!viewIntent || viewIntent.route !== "/ideas") {
      handledViewIntent.current = null;
      return;
    }
    if (handledViewIntent.current === requestKey) return;

    if (typeof viewIntent.state.search === "string") {
      setSearch(viewIntent.state.search);
    }
    if (typeof viewIntent.state.activeTopicId === "string") {
      setActiveTopicId(viewIntent.state.activeTopicId);
    }
    if ("activeNoteId" in viewIntent.state) {
      setActiveNoteId(
        typeof viewIntent.state.activeNoteId === "string"
          ? viewIntent.state.activeNoteId
          : null
      );
    }
    if (
      viewIntent.state.mobileView === "topics" ||
      viewIntent.state.mobileView === "notes" ||
      viewIntent.state.mobileView === "editor"
    ) {
      setMobileView(viewIntent.state.mobileView);
    }

    handledViewIntent.current = requestKey;
  }, [location.state]);

  const storedActiveNote = notes.find((note) => note.id === activeNoteId) ?? null;
  const notesWithDraft = useMemo(
    () =>
      draftNote
        ? notes.map((note) => (note.id === draftNote.id ? draftNote : note))
        : notes,
    [draftNote, notes]
  );

  const topicNotes = useMemo(
    () =>
      notesWithDraft
        .filter((note) => note.topicId === activeTopicId)
        .filter((note) => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          const content = note.blocks.map((block) => block.content).join(" ").toLowerCase();
          return note.title.toLowerCase().includes(q) || content.includes(q);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notesWithDraft, activeTopicId, search]
  );

  const activeNote = notesWithDraft.find((note) => note.id === activeNoteId) ?? null;
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? null;
  const showWorkspace = isMobile || workspaceVisible;
  const showEditorPane = Boolean(activeNote);

  function newId() {
    return crypto.randomUUID();
  }

  function commitDraft(nextDraft: IdeaNote | null, options?: { immediate?: boolean }) {
    if (!nextDraft || !isDraftDirty) return;
    if (draftCommitTimer.current) {
      clearTimeout(draftCommitTimer.current);
      draftCommitTimer.current = null;
    }

    setSaveState(options?.immediate ? "saving" : "saved");
    setIsDraftDirty(false);
    // Persist synchronously so topic / workspace switches never read stale store
    // before the debounced transition would have flushed (fixes “lost” edits).
    update((d: AppData) => ({
      ...d,
      ideaNotes: (d.ideaNotes ?? []).map((note: IdeaNote) =>
        note.id === nextDraft.id ? nextDraft : note
      ),
    }));
    setSaveState("saved");
  }

  useEffect(() => {
    if (!storedActiveNote) {
      setDraftNote(null);
      setIsDraftDirty(false);
      setSaveState("saved");
      return;
    }

    if (draftNote?.id !== storedActiveNote.id) {
      setDraftNote(cloneIdeaNote(storedActiveNote));
      setIsDraftDirty(false);
      setSaveState("saved");
      return;
    }

    if (!isDraftDirty && storedActiveNote.updatedAt !== draftNote.updatedAt) {
      setDraftNote(cloneIdeaNote(storedActiveNote));
    }
  }, [storedActiveNote, draftNote?.id, draftNote?.updatedAt, isDraftDirty]);

  useEffect(() => {
    if (!draftNote || !isDraftDirty) return;
    setSaveState("dirty");
    if (draftCommitTimer.current) clearTimeout(draftCommitTimer.current);
    draftCommitTimer.current = setTimeout(() => {
      commitDraft(draftNote, { immediate: true });
    }, 1500);

    return () => {
      if (draftCommitTimer.current) {
        clearTimeout(draftCommitTimer.current);
        draftCommitTimer.current = null;
      }
    };
  }, [draftNote?.updatedAt, isDraftDirty]);

  useEffect(() => {
    return () => {
      if (draftCommitTimer.current) clearTimeout(draftCommitTimer.current);
    };
  }, []);

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
    const name = newTopicName.trim();
    const topic: IdeaTopic = {
      id: newId(),
      name,
      emoji: name.slice(0, 2).toUpperCase() || "WS",
    };
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
      setMobileView(nextTopicId ? "notes" : "topics");
    }

    setTopicDeleteConfirmId(null);
  }

  function createNote() {
    if (!activeTopicId) return;
    commitDraft(draftNote, { immediate: true });

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
    if (!isMobile) setWorkspaceVisible(false);
  }

  function updateNoteDraft(id: string, patch: Partial<IdeaNote>) {
    setDraftNote((current) => {
      if (!current || current.id !== id) return current;
      return {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDraftDirty(true);
    setSaveState("dirty");
    if (!isMobile) setWorkspaceVisible(false);
  }

  function deleteNote(id: string) {
    update((d: AppData) => ({ ...d, ideaNotes: (d.ideaNotes ?? []).filter((note: IdeaNote) => note.id !== id) }));
    if (activeNoteId === id) {
      setActiveNoteId(null);
      setDraftNote(null);
      setIsDraftDirty(false);
      setSaveState("saved");
      setMobileView("notes");
      if (!isMobile) setWorkspaceVisible(true);
    }
    setNoteDeleteConfirmId(null);
  }

  return (
    <div className="flex flex-1 min-h-[min(640px,calc(100dvh-9.5rem))] flex-col overflow-hidden">
      <div className="hidden md:block mb-5 flex-shrink-0">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>
          Ideas
        </div>
        <h1 className="page-title">Research & Brainstorm</h1>
      </div>

      <div
        className={cn("flex min-h-0 flex-1 overflow-hidden", isMobile ? "rounded-[26px]" : "rounded-[28px]")}
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid rgba(var(--border-rgb),0.07)",
          boxShadow: "0 26px 90px rgba(0,0,0,0.16)",
          overflow: "hidden",
        }}
      >
        <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-r flex-shrink-0",
            mobileView === "topics" ? "flex w-full" : "hidden",
            showWorkspace ? "md:flex" : "md:hidden",
            "w-full md:w-[250px]"
          )}
          style={{ borderColor: "rgba(var(--border-rgb),0.06)", background: "var(--bg-card)" }}
        >
          <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: "rgba(var(--border-rgb),0.06)" }}>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
              <FolderPen size={12} />
              Workspace
            </div>
            <div className="mt-3 relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx-4)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages…"
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-[12px] outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid rgba(var(--border-rgb),0.06)", color: "var(--tx-1)" }}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-28 md:pb-3 space-y-1">
            {(data.ideaTopics ?? []).length === 0 && !addingTopic && (
              <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
                <Lightbulb size={28} style={{ color: "var(--tx-4)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--tx-2)" }}>No topics yet</p>
                  <p className="text-xs mt-1" style={{ color: "var(--tx-4)" }}>Create a topic to start organizing your ideas.</p>
                </div>
                <button
                  onClick={() => setAddingTopic(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold"
                  style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
                >
                  <Plus size={13} /> New Topic
                </button>
              </div>
            )}
            {topics.map((topic) => {
              const topicCount = notes.filter((note) => note.topicId === topic.id).length;
              const isActive = topic.id === activeTopicId;
              const isEditing = editingTopicId === topic.id;
              const isDeletePending = topicDeleteConfirmId === topic.id;

              return (
                <div
                  key={topic.id}
                  className="group rounded-2xl px-3 py-3 transition-[background-color,border-color] cursor-pointer"
                  role="button"
                  tabIndex={0}
                  style={
                    isActive
                      ? { background: "rgba(var(--surface-rgb),0.06)", border: `1px solid ${theme.border}` }
                      : { border: "1px solid transparent" }
                  }
                  onClick={() => {
                    commitDraft(draftNote, { immediate: true });
                    if (isEditing) return;
                    setActiveTopicId(topic.id);
                    setActiveNoteId(null);
                    setMobileView("notes");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      commitDraft(draftNote, { immediate: true });
                      if (isEditing) return;
                      setActiveTopicId(topic.id);
                      setActiveNoteId(null);
                      setMobileView("notes");
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: theme.dim, color: isActive ? theme.accent : `${theme.accent}99` }}
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
                          className="w-full rounded-lg px-2 py-1 text-sm font-semibold outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--tx-1)" }}
                        />
                      ) : (
                        <div className="text-sm font-semibold truncate" style={{ color: isActive ? "var(--tx-1)" : "var(--tx-2)" }}>
                          {topic.name}
                        </div>
                      )}
                      <div className="text-[11px] mt-0.5" style={{ color: isActive ? theme.accent : "var(--tx-4)" }}>
                        {topicCount} pages
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          beginTopicEdit(topic);
                        }}
                      >
                        <Pencil size={12} style={{ color: "var(--tx-4)" }} />
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
                  placeholder="New space…"
                  style={{ background: "var(--bg-input)", border: "1px solid rgba(var(--border-rgb),0.06)", color: "var(--tx-1)" }}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingTopic(true)}
                className="w-full mt-2 flex items-center gap-2 px-3 py-3 rounded-2xl text-[12px] font-medium transition-[background-color,border-color,color]"
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
            "flex min-h-0 flex-col overflow-hidden border-r flex-shrink-0",
            mobileView === "notes" ? "flex w-full" : "hidden",
            "md:flex",
            "w-full md:w-[320px] flex-shrink-0"
          )}
          style={{ borderColor: "rgba(var(--border-rgb),0.06)", background: "var(--bg-base)" }}
        >
          <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "rgba(var(--border-rgb),0.06)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setMobileView("topics")}
                  className="md:hidden flex-shrink-0"
                >
                  <ArrowLeft size={16} style={{ color: "var(--tx-3)" }} />
                </button>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
                    Pages
                  </div>
                  <div className="text-[17px] font-bold mt-1 truncate" style={{ color: "var(--tx-1)" }}>
                    {activeTopic.name}
                  </div>
                </div>
              </div>
              <button
                onClick={createNote}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold flex-shrink-0"
                style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
              >
                <Plus size={13} />
                New page
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-28 md:pb-3 space-y-2">
            {topicNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <BookOpen size={22} style={{ color: theme.accent }} />
                <div className="mt-3 text-sm" style={{ color: "var(--tx-3)" }}>
                  No pages in this space yet.
                </div>
                <button onClick={createNote} className="mt-4 text-[12px] font-semibold" style={{ color: theme.accent }}>
                  Create your first page
                </button>
              </div>
            ) : (
              topicNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                const previewText = note.blocks.map((block) => block.content).join(" ").trim();
                const preview =
                  previewText.length > 0
                    ? previewText.length > 160
                      ? `${previewText.slice(0, 160)}…`
                      : previewText
                    : "Empty page";
                const isDeletePending = noteDeleteConfirmId === note.id;
                const dateLabel = new Date(note.updatedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                });

                return (
                  <div
                    key={note.id}
                    className="group rounded-2xl px-4 py-3 cursor-pointer transition-[background-color,border-color]"
                    role="button"
                    tabIndex={0}
                    style={
                      isActive
                        ? { background: "rgba(var(--surface-rgb),0.07)", border: `1px solid ${theme.border}` }
                        : { background: "rgba(var(--surface-rgb),0.025)", border: "1px solid rgba(var(--border-rgb),0.05)" }
                    }
                    onClick={() => {
                      commitDraft(draftNote, { immediate: true });
                      setActiveNoteId(note.id);
                      setMobileView("editor");
                      if (!isMobile) setWorkspaceVisible(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        commitDraft(draftNote, { immediate: true });
                        setActiveNoteId(note.id);
                        setMobileView("editor");
                        if (!isMobile) setWorkspaceVisible(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold truncate" style={{ color: isActive ? "var(--tx-1)" : "var(--tx-2)" }}>
                            {note.title || "Untitled"}
                          </div>
                          <NoteDeleteButton
                            pending={isDeletePending}
                            onRequest={() => setNoteDeleteConfirmId(note.id)}
                            onConfirm={() => deleteNote(note.id)}
                            onCancel={() => setNoteDeleteConfirmId(null)}
                          />
                        </div>
                        <div className="text-[11px] mt-1 line-clamp-5" style={{ color: "var(--tx-4)" }}>
                          {preview}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px]" style={{ color: `${theme.accent}80` }}>
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
          <section
            className={cn(
              "relative z-[var(--z-base)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
              mobileView === "editor" ? "flex" : "hidden md:flex"
            )}
          >
            <NoteEditor
              note={activeNote}
              theme={theme}
              onUpdate={(patch) => updateNoteDraft(activeNote.id, patch)}
              onBack={() => {
                commitDraft(draftNote, { immediate: true });
                setMobileView("notes");
              }}
              workspaceSidebarVisible={workspaceVisible}
              onToggleWorkspaceSidebar={
                isMobile ? undefined : () => setWorkspaceVisible((current) => !current)
              }
              saveState={saveState}
            />
          </section>
        )}
      </div>
    </div>
  );
}

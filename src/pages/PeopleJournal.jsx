import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Bot, Brain, CalendarDays, Edit3, Link2, Loader2, Plus, Save, Search, Send, Trash2, Unlink, UserRound, X } from "lucide-react";
import { postJson } from "../lib/api";
import { todayIndiaInput } from "../lib/format";

const today = todayIndiaInput();

export default function PeopleJournal() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [personForm, setPersonForm] = useState({ name: "", details: "" });
  const [entryForm, setEntryForm] = useState({ entry_date: today, knowledge: "", behavior: "", notes: "" });
  const [personQuestion, setPersonQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [editingPersonId, setEditingPersonId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", details: "" });
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [linkedUser, setLinkedUser] = useState(null);
  const [editUserSearch, setEditUserSearch] = useState("");
  const [editUserResults, setEditUserResults] = useState([]);
  const [editLinkedUser, setEditLinkedUser] = useState(null);
  const [universalQuestion, setUniversalQuestion] = useState("");
  const [universalMessages, setUniversalMessages] = useState([]);
  const [universalSessionId, setUniversalSessionId] = useState("");
  const [universalPerson, setUniversalPerson] = useState(null);
  const [universalMatches, setUniversalMatches] = useState([]);
  const [asking, setAsking] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [entryDateFilter, setEntryDateFilter] = useState("");
  const [entryPage, setEntryPage] = useState(1);
  const entriesRef = useRef(null);

  const selectedPerson = useMemo(
    () => people.find((person) => Number(person.id) === Number(selectedId)) || people[0],
    [people, selectedId]
  );

  const loadPeople = async () => {
    if (!isAuthenticated || !user?.email) return;
    setLoading(true);
    try {
      const data = await postJson("/people_journal.php", { email: user.email, action: "list" });
      if (data.status === "success") {
        setPeople(data.people || []);
        if (!selectedId && data.people?.[0]) setSelectedId(data.people[0].id);
        if (selectedId && !data.people?.some((person) => Number(person.id) === Number(selectedId))) {
          setSelectedId(data.people?.[0]?.id || "");
        }
      }
    } catch {
      setMessage("Could not load people journal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) loadPeople();
  }, [isLoading, isAuthenticated, user?.email]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.email) loadUniversalHistory();
  }, [isLoading, isAuthenticated, user?.email]);

  useEffect(() => {
    const timer = setTimeout(() => searchDiaryUsers(userSearch, setUserResults, setSearchingUsers), 400);
    return () => clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => searchDiaryUsers(editUserSearch, setEditUserResults, setSearchingUsers), 400);
    return () => clearTimeout(timer);
  }, [editUserSearch]);

  useEffect(() => {
    if (selectedPerson?.id) {
      loadChat(selectedPerson.id);
      setPersonQuestion("");
    } else {
      setChatMessages([]);
    }
  }, [selectedPerson?.id]);

  const loadChat = async (personId) => {
    if (!user?.email || !personId) return;
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "chat_history",
        person_id: personId,
      });
      if (data.status === "success") setChatMessages(data.messages || []);
    } catch {
      setMessage("Could not load person chat.");
    }
  };

  const searchDiaryUsers = async (query, setter, loadingSetter) => {
    if (!user?.email || query.trim().length < 1) {
      setter([]);
      return;
    }
    loadingSetter(true);
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "search_users",
        query,
      });
      if (data.status === "success") {
        setter((data.users || []).filter((item) => Number(item.id) !== Number(data.current_user_id)));
      }
    } catch {
      setter([]);
    } finally {
      loadingSetter(false);
    }
  };

  const createPerson = async () => {
    if (!personForm.name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "create_person",
        ...personForm,
        linked_user_id: linkedUser?.id || 0,
      });
      if (data.status !== "success") throw new Error(data.message);
      setPersonForm({ name: "", details: "" });
      setLinkedUser(null);
      setUserSearch("");
      setUserResults([]);
      setSelectedId(data.person_id);
      setMessage("Person saved.");
      await loadPeople();
    } catch (error) {
      setMessage(error.message || "Could not save person.");
    } finally {
      setSaving(false);
    }
  };

  const beginEditPerson = (person) => {
    setEditingPersonId(person.id);
    setEditForm({ name: person.name || "", details: person.details || "" });
    setEditLinkedUser(person.linked_user_id ? {
      id: person.linked_user_id,
      username: person.linked_username,
      full_name: person.linked_full_name,
    } : null);
    setEditUserSearch("");
    setEditUserResults([]);
  };

  const updatePerson = async () => {
    if (!editingPersonId || !editForm.name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "update_person",
        person_id: editingPersonId,
        ...editForm,
        linked_user_id: editLinkedUser?.id || 0,
      });
      if (data.status !== "success") throw new Error(data.message);
      setEditingPersonId("");
      setMessage("Person updated.");
      await loadPeople();
    } catch (error) {
      setMessage(error.message || "Could not update person.");
    } finally {
      setSaving(false);
    }
  };

  const deletePerson = async (person) => {
    const ok = window.confirm(`Delete ${person.name}? This removes their details, daily entries, and AI chat history.`);
    if (!ok) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "delete_person",
        person_id: person.id,
      });
      if (data.status !== "success") throw new Error(data.message);
      setSelectedId("");
      setChatMessages([]);
      setMessage("Person deleted.");
      await loadPeople();
    } catch (error) {
      setMessage(error.message || "Could not delete person.");
    } finally {
      setSaving(false);
    }
  };

  const addPersonEntry = async () => {
    if (!selectedPerson) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "add_entry",
        person_id: selectedPerson.id,
        ...entryForm,
      });
      if (data.status !== "success") throw new Error(data.message);
      setEntryForm({ entry_date: today, knowledge: "", behavior: "", notes: "" });
      setMessage("Daily person entry saved.");
      await loadPeople();
    } catch (error) {
      setMessage(error.message || "Could not save daily entry.");
    } finally {
      setSaving(false);
    }
  };

  const askPerson = async (entry = null, presetQuestion = "") => {
    const questionText = (presetQuestion || personQuestion).trim();
    if (!selectedPerson || !questionText) return;
    setAsking("person");
    const outgoing = questionText;
    setChatMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: "user", message: outgoing, created_at: new Date().toISOString() },
    ]);
    if (!presetQuestion) setPersonQuestion("");
    try {
      const data = await postJson("/people_journal.php", {
        email: user.email,
        action: "person_chat",
        person_id: selectedPerson.id,
        entry_id: entry?.id || 0,
        message: outgoing,
      });
      if (data.messages) {
        setChatMessages(data.messages);
      } else {
        setChatMessages((current) => [
          ...current,
          { id: `assistant-${Date.now()}`, role: "assistant", message: data.answer || data.message || "No answer returned.", created_at: new Date().toISOString() },
        ]);
      }
    } catch {
      const fallback = "Could not ask AI about this person.";
      setChatMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", message: fallback, created_at: new Date().toISOString() },
      ]);
    } finally {
      setAsking("");
    }
  };

  const askUniversal = async () => {
    if (!universalQuestion.trim()) return;
    setAsking("universal");
    setUniversalMatches([]);
    const outgoing = universalQuestion.trim();
    const selectedForQuestion = universalPerson && outgoing.includes(`@${universalPerson.name}`) ? universalPerson : null;
    setUniversalMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: "user", message: outgoing, created_at: new Date().toISOString() },
    ]);
    setUniversalQuestion("");
    setUniversalPerson(null);
    try {
      const data = await postJson("/universal_ai.php", {
        email: user.email,
        question: outgoing,
        action: "ask",
        session_id: universalSessionId || 0,
        person_id: selectedForQuestion?.id || 0,
      });
      if (data.session_id) setUniversalSessionId(data.session_id);
      if (data.messages) {
        setUniversalMessages(data.messages);
      } else {
        setUniversalMessages((current) => [
          ...current,
          { id: `assistant-${Date.now()}`, role: "assistant", message: data.answer || data.message || "No answer returned.", created_at: new Date().toISOString() },
        ]);
      }
      setUniversalMatches(data.matches || []);
    } catch (error) {
      const fallback = error.message || "Could not ask universal AI.";
      setUniversalMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", message: fallback, created_at: new Date().toISOString() },
      ]);
    } finally {
      setAsking("");
    }
  };

  const loadUniversalHistory = async (sessionId = 0) => {
    try {
      const data = await postJson("/universal_ai.php", {
        email: user.email,
        action: "history",
        session_id: sessionId,
      });
      if (data.status === "success") {
        setUniversalSessionId(data.session_id || "");
        setUniversalMessages(data.messages || []);
      }
    } catch {
      setMessage("Could not load universal AI chat.");
    }
  };

  const startNewUniversalChat = async () => {
    setAsking("universal-new");
    setUniversalQuestion("");
    setUniversalPerson(null);
    setUniversalMatches([]);
    try {
      const data = await postJson("/universal_ai.php", {
        email: user.email,
        action: "new_chat",
      });
      if (data.status === "success") {
        setUniversalSessionId(data.session_id || "");
        setUniversalMessages([]);
      }
    } catch {
      setMessage("Could not start a new universal AI chat.");
    } finally {
      setAsking("");
    }
  };

  const entries = selectedPerson?.entries || [];
  const filteredEntries = useMemo(() => {
    const needle = entrySearch.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesDate = !entryDateFilter || entry.entry_date === entryDateFilter;
      const haystack = `${entry.entry_date} ${entry.knowledge || ""} ${entry.behavior || ""} ${entry.notes || ""}`.toLowerCase();
      const matchesText = !needle || haystack.includes(needle);
      return matchesDate && matchesText;
    });
  }, [entries, entryDateFilter, entrySearch]);
  const entryPageCount = Math.max(1, Math.ceil(filteredEntries.length / 10));
  const visibleEntries = filteredEntries.slice((entryPage - 1) * 10, entryPage * 10);

  useEffect(() => {
    setEntryPage(1);
  }, [entrySearch, entryDateFilter]);

  const openUniversalMatch = (match) => {
    setSelectedId(match.person_id);
    setEntryDateFilter(match.entry_date || "");
    setEntrySearch("");
    setEntryPage(1);
    setMessage(`Opened ${match.person_name || "person"} note from ${match.entry_date}.`);
    setTimeout(() => entriesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f1] px-3 py-5 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-600">People Memory</p>
            <h1 className="text-3xl font-serif font-bold text-stone-900">People in my life</h1>
          </div>
          {message && <p className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-stone-600 shadow-sm">{message}</p>}
        </div>

        <section className="mb-6 rounded-lg border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-orange-500" />
              <h2 className="font-black text-stone-900">Universal journal AI</h2>
            </div>
            <button onClick={startNewUniversalChat} disabled={asking === "universal-new"} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-black uppercase text-stone-600 hover:bg-stone-50 disabled:opacity-50">
              {asking === "universal-new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New Chat
            </button>
          </div>
          <div className="mb-3 max-h-80 space-y-3 overflow-auto rounded-lg bg-stone-50 p-3">
            {universalMessages.length === 0 ? (
              <p className="p-6 text-center text-sm font-semibold text-stone-400">Start a universal chat. Type @ to choose one person for a specific answer.</p>
            ) : universalMessages.map((item) => (
              <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm font-medium leading-6 ${item.role === "user" ? "bg-orange-500 text-white" : "bg-white text-stone-700 shadow-sm"}`}>
                  {item.message}
                </div>
              </div>
            ))}
            {asking === "universal" && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-stone-500 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <PersonMentionInput
              value={universalQuestion}
              onChange={setUniversalQuestion}
              people={people}
              selectedPerson={universalPerson}
              setSelectedPerson={setUniversalPerson}
            />
            <button onClick={askUniversal} disabled={asking === "universal"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              {asking === "universal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Ask All Journals
            </button>
          </div>
          {universalMatches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {universalMatches.map((match) => (
                <button
                  key={`${match.person_id}-${match.entry_id}`}
                  onClick={() => openUniversalMatch(match)}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-100"
                >
                  <Search className="h-3.5 w-3.5" />
                  Open {match.person_name} note - {match.entry_date}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Plus className="h-5 w-5 text-orange-500" />
                <h2 className="font-black text-stone-900">Create person</h2>
              </div>
              <input value={personForm.name} onChange={(event) => setPersonForm({ ...personForm, name: event.target.value })} placeholder="Name" className="mb-3 w-full rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-300" />
              <textarea value={personForm.details} onChange={(event) => setPersonForm({ ...personForm, details: event.target.value })} rows="4" placeholder="Who they are, relationship, important details..." className="w-full resize-none rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-300" />
              <UserLinkPicker
                label="Link diary username"
                search={userSearch}
                setSearch={setUserSearch}
                selected={linkedUser}
                setSelected={setLinkedUser}
                results={userResults}
                searching={searchingUsers}
              />
              <button onClick={createPerson} disabled={saving || !personForm.name.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                <Save className="h-4 w-4" />
                Save Person
              </button>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              {people.length === 0 ? (
                <p className="p-6 text-center text-sm font-semibold text-stone-400">Create a person to start tracking daily behavior and memories.</p>
              ) : people.map((person) => (
                <div key={person.id} className={`mb-2 rounded-lg border p-2 transition ${Number(selectedPerson?.id) === Number(person.id) ? "border-orange-300 bg-orange-50" : "border-stone-100 bg-white hover:bg-stone-50"}`}>
                  <button
                    onClick={() => {
                      setSelectedId(person.id);
                      setEntrySearch("");
                      setEntryDateFilter("");
                      setEntryPage(1);
                    }}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <UserRound className="h-5 w-5 shrink-0 text-stone-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-stone-900">{person.name}</p>
                      <p className="line-clamp-1 text-xs font-semibold text-stone-500">
                        {person.linked_username ? `@${person.linked_username}` : (person.details || "No details yet")}
                      </p>
                    </div>
                  </button>
                  <div className="mt-2 flex gap-2 pl-8">
                    <button onClick={() => beginEditPerson(person)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-black uppercase text-stone-600 shadow-sm">
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button onClick={() => deletePerson(person)} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-black uppercase text-red-600 shadow-sm">
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="space-y-4">
            {selectedPerson ? (
              <>
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  {Number(editingPersonId) === Number(selectedPerson.id) ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-xl font-black text-stone-900">Edit person</h2>
                        <button onClick={() => setEditingPersonId("")} className="rounded-md p-2 text-stone-500 hover:bg-stone-100" aria-label="Cancel edit">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="mb-3 w-full rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                      <textarea value={editForm.details} onChange={(event) => setEditForm({ ...editForm, details: event.target.value })} rows="3" className="w-full resize-none rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                      <UserLinkPicker
                        label="Bind diary username"
                        search={editUserSearch}
                        setSearch={setEditUserSearch}
                        selected={editLinkedUser}
                        setSelected={setEditLinkedUser}
                        results={editUserResults}
                        searching={searchingUsers}
                      />
                      <button onClick={updatePerson} disabled={saving || !editForm.name.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-black text-stone-900">{selectedPerson.name}</h2>
                      <p className="mt-1 text-sm font-medium leading-6 text-stone-600">{selectedPerson.details || "Add daily entries to build this person's memory."}</p>
                      {selectedPerson.linked_username && (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                          <Link2 className="h-3.5 w-3.5" />
                          Linked to @{selectedPerson.linked_username}
                        </p>
                      )}
                    </>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-orange-500" />
                    <h3 className="font-black text-stone-900">Today's person entry</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="date" value={entryForm.entry_date} onChange={(event) => setEntryForm({ ...entryForm, entry_date: event.target.value })} className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                    <input value={entryForm.knowledge} onChange={(event) => setEntryForm({ ...entryForm, knowledge: event.target.value })} placeholder="What I learned about them today" className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                    <textarea value={entryForm.behavior} onChange={(event) => setEntryForm({ ...entryForm, behavior: event.target.value })} rows="3" placeholder="How they behaved with me" className="resize-none rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                    <textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} rows="3" placeholder="Any extra note, concern, good moment, or decision context" className="resize-none rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                  </div>
                  <button onClick={addPersonEntry} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                    <Save className="h-4 w-4" />
                    Save Daily Entry
                  </button>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-orange-500" />
                    <h3 className="font-black text-stone-900">Chat about {selectedPerson.name}</h3>
                  </div>
                  <div className="mb-4 max-h-96 space-y-3 overflow-auto rounded-lg bg-stone-50 p-3">
                    {chatMessages.length === 0 ? (
                      <p className="p-6 text-center text-sm font-semibold text-stone-400">No chat yet. Ask something about this person and the conversation will be saved here.</p>
                    ) : chatMessages.map((item) => (
                      <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm font-medium leading-6 ${item.role === "user" ? "bg-orange-500 text-white" : "bg-white text-stone-700 shadow-sm"}`}>
                          {item.message}
                        </div>
                      </div>
                    ))}
                    {asking === "person" && (
                      <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-stone-500 shadow-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input value={personQuestion} onChange={(event) => setPersonQuestion(event.target.value)} placeholder={`Ask AI anything about ${selectedPerson.name}...`} className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium" />
                    <button onClick={() => askPerson()} disabled={asking === "person"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                      {asking === "person" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Ask Person AI
                    </button>
                  </div>
                </section>

                <section ref={entriesRef} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-black text-stone-900">Recent entries</h3>
                      <p className="text-xs font-semibold text-stone-400">Showing 10 at a time so the page stays tidy.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={entrySearch}
                        onChange={(event) => setEntrySearch(event.target.value)}
                        placeholder="Search this person's notes..."
                        className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium outline-none focus:border-orange-300"
                      />
                      <input
                        type="date"
                        value={entryDateFilter}
                        onChange={(event) => setEntryDateFilter(event.target.value)}
                        className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium outline-none focus:border-orange-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {entries.length === 0 ? <p className="text-sm font-semibold text-stone-400">No daily entries yet.</p> : visibleEntries.length === 0 ? <p className="text-sm font-semibold text-stone-400">No entries match this search.</p> : visibleEntries.map((entry) => (
                      <article key={entry.id} className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-black uppercase tracking-widest text-orange-600">{entry.entry_date}</p>
                          <button
                            onClick={() => askPerson(entry, `Analyze this ${entry.entry_date} entry about ${selectedPerson.name}. Why could this have happened, what might be the problem, what should I do, and what should I avoid?`)}
                            disabled={asking === "person"}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-black uppercase text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                          >
                            {asking === "person" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                            Ask AI
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-stone-700"><b>Know:</b> {entry.knowledge || "-"}</p>
                        <p className="mt-1 text-sm text-stone-700"><b>Behavior:</b> {entry.behavior || "-"}</p>
                        <p className="mt-1 text-sm text-stone-700"><b>Notes:</b> {entry.notes || "-"}</p>
                      </article>
                    ))}
                  </div>
                  {entries.length > 10 && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-stone-400">
                        Page {entryPage} of {entryPageCount} | {filteredEntries.length} matching entries
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setEntryPage((page) => Math.max(1, page - 1))} disabled={entryPage <= 1} className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-black uppercase text-stone-600 disabled:opacity-40">
                          Previous
                        </button>
                        <button onClick={() => setEntryPage((page) => Math.min(entryPageCount, page + 1))} disabled={entryPage >= entryPageCount} className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-black uppercase text-stone-600 disabled:opacity-40">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function PersonMentionInput({ value, onChange, people, selectedPerson, setSelectedPerson }) {
  const mention = useMemo(() => {
    const atIndex = value.lastIndexOf("@");
    if (atIndex < 0) return { active: false, atIndex: -1, query: "" };
    const before = value[atIndex - 1] || " ";
    const after = value.slice(atIndex + 1);
    if (!/\s/.test(before) || /\s/.test(after)) return { active: false, atIndex, query: "" };
    return { active: true, atIndex, query: after.toLowerCase() };
  }, [value]);

  const suggestions = useMemo(() => {
    if (!mention.active) return [];
    return people
      .filter((person) => {
        const text = `${person.name || ""} ${person.linked_username || ""} ${person.linked_full_name || ""}`.toLowerCase();
        return text.includes(mention.query);
      })
      .slice(0, 8);
  }, [mention, people]);

  const choosePerson = (person) => {
    const prefix = value.slice(0, mention.atIndex);
    const suffix = value.slice(mention.atIndex + mention.query.length + 1);
    onChange(`${prefix}@${person.name} ${suffix}`.replace(/\s+/g, " ").trimStart());
    setSelectedPerson(person);
  };

  const updateValue = (nextValue) => {
    onChange(nextValue);
    if (selectedPerson && !nextValue.includes(`@${selectedPerson.name}`)) {
      setSelectedPerson(null);
    }
  };

  return (
    <div className="relative">
      {selectedPerson && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-700">
          <UserRound className="h-3.5 w-3.5" />
          Asking about {selectedPerson.name}
          <button onClick={() => setSelectedPerson(null)} className="rounded p-0.5 hover:bg-emerald-100" aria-label="Clear selected person">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <input
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        placeholder="Ask anything, or type @ to choose one person..."
        className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-300"
      />
      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-lg border border-stone-200 bg-white p-2 shadow-xl">
          {suggestions.map((person) => (
            <button
              key={person.id}
              onClick={() => choosePerson(person)}
              className="mb-1 flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-orange-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-black text-orange-700">
                {(person.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-stone-900">{person.name}</p>
                <p className="truncate text-xs font-semibold text-stone-500">{person.linked_username ? `@${person.linked_username}` : person.details || "Person memory"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserLinkPicker({ label, search, setSearch, selected, setSelected, results, searching }) {
  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-stone-500">{label}</p>
        {selected && (
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-black uppercase text-red-600 shadow-sm">
            <Unlink className="h-3 w-3" />
            Unlink
          </button>
        )}
      </div>

      {selected ? (
        <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
            {(selected.username || selected.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-stone-900">{selected.full_name || selected.username}</p>
            <p className="truncate text-xs font-semibold text-stone-500">@{selected.username || "unknown"}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search diary username..."
              className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium outline-none focus:border-orange-300"
            />
          </div>
          <div className="mt-2 max-h-44 overflow-auto">
            {searching ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              </div>
            ) : results.length > 0 ? (
              results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(item);
                    setSearch("");
                  }}
                  className="mb-2 flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-sm hover:bg-orange-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-black text-orange-700">
                    {(item.username || item.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-stone-900">{item.full_name || item.username}</p>
                    <p className="truncate text-xs font-semibold text-stone-500">@{item.username}</p>
                  </div>
                </button>
              ))
            ) : search.length >= 1 ? (
              <p className="py-3 text-center text-xs font-semibold text-stone-400">No diary user found.</p>
            ) : (
              <p className="py-3 text-center text-xs font-semibold text-stone-400">Start typing a username to see suggestions.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

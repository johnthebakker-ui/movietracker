"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { addToList, type ListActionState } from "@/app/actions/library";

const initialState: ListActionState = { status: "idle", message: "" };

export function AddToListForm({ mediaId, path, lists }: { mediaId: number; path: string; lists: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addToList, initialState);
  return <>
    <form action={action} className="add-list-form">
      <label><span className="sr-only">Choose list</span><select className="select" name="listId" aria-label="Choose list">{lists.map(list => <option value={list.id} key={list.id}>{list.name}</option>)}</select></label>
      <input type="hidden" name="mediaId" value={mediaId} /><input type="hidden" name="path" value={path} />
      <button className="button ghost" disabled={pending}><ListPlus size={16} /> {pending ? "Adding…" : "Add to list"}</button>
    </form>
    {state.status !== "idle" && <div className={`toast ${state.status}`} role="status"><span>{state.status === "success" ? "✓" : "!"}</span>{state.message}</div>}
  </>;
}

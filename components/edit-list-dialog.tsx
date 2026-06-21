"use client";

import { ImageIcon, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateList } from "@/app/actions/library";

type EditableList = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "followers" | "private";
  cover_url: string | null;
  featured_media_id: number | null;
};

export function EditListDialog({ list, items }: { list: EditableList; items: { id: number; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = (formData: FormData) => startTransition(async () => {
    const result = await updateList({ status: "idle", message: "" }, formData);
    if (result.status === "success") { setError(""); setOpen(false); }
    else setError(result.message);
  });

  return <>
    <button className="button ghost" type="button" onClick={() => setOpen(true)}><Pencil size={16} /> Edit list</button>
    {open && <>
      <button className="dialog-scrim" aria-label="Close list editor" onClick={() => setOpen(false)} />
      <div className="create-list-panel edit-list-panel" role="dialog" aria-modal="true" aria-label={`Edit ${list.name}`}>
        <div className="section-head"><div><div className="eyebrow">Collection settings</div><h2 className="display">Edit list</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></div>
        <form action={submit} encType="multipart/form-data">
          <input type="hidden" name="listId" value={list.id} />
          <div className="form-grid">
            <div className="field"><label>Name</label><input className="input" name="name" defaultValue={list.name} required maxLength={80} /></div>
            <div className="field"><label>Visibility</label><select className="select" name="visibility" defaultValue={list.visibility}><option value="public">Everyone</option><option value="followers">Followers</option><option value="private">Only me</option></select></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Description</label><textarea className="textarea" name="description" defaultValue={list.description ?? ""} maxLength={1000} placeholder="What belongs in this collection?" /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Custom cover image</label><label className="list-upload-control"><ImageIcon size={18} /><span>Choose a JPG, PNG, or WebP image (maximum 5 MB)</span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></label>{list.cover_url && <label className="check-row"><input type="checkbox" name="removeCover" /> Remove the current custom cover</label>}</div>
          <div className="field" style={{ marginTop: 12 }}><label>Main title artwork</label><select className="select" name="featuredMediaId" defaultValue={list.featured_media_id ?? ""}><option value="">Automatic poster stack</option>{items.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select><small className="field-hint">Used when there is no custom cover. Add titles first to choose one.</small></div>
          {error && <p className="form-error">{error}</p>}
          <button className="button accent" style={{ marginTop: 18 }} disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        </form>
      </div>
    </>}
  </>;
}

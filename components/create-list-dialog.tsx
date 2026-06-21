"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { createList } from "@/app/actions/library";

export function CreateListDialog() {
  const [open, setOpen] = useState(false);
  return <><button className="button accent" onClick={() => setOpen(true)}><Plus size={17} /> New list</button>{open && <><button className="dialog-scrim" aria-label="Close create-list dialog" onClick={() => setOpen(false)} /><div className="create-list-panel" role="dialog" aria-modal="true" aria-label="Create a list"><div className="section-head"><div><div className="eyebrow">New collection</div><h2 className="display">Create a list</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></div><form action={createList}><div className="field"><label>Name</label><input className="input" name="name" required maxLength={80} placeholder="Late-night creature features" /></div><div className="field" style={{ marginTop: 12 }}><label>Description</label><textarea className="textarea" name="description" maxLength={1000} placeholder="What belongs in this collection?" /></div><div className="field" style={{ marginTop: 12 }}><label>Visibility</label><select className="select" name="visibility"><option value="public">Everyone</option><option value="followers">Followers</option><option value="private">Only me</option></select></div><button className="button accent" style={{ marginTop: 16 }}>Create list</button></form></div></>}</>;
}

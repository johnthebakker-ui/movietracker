"use client";

import { Trash2 } from "lucide-react";
import { deleteWatchEvent } from "@/app/actions/library";

export function DeleteWatchEventForm({ eventId, title }: { eventId: string; title: string }) {
  return <form className="history-delete-form" action={deleteWatchEvent} onSubmit={event => { if (!window.confirm(`Remove this ${title} watch from your history?`)) event.preventDefault(); }}>
    <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="path" value="/history" />
    <button className="history-delete" title="Remove this watch from history" aria-label={`Remove ${title} from watch history`}><Trash2 size={14} /></button>
  </form>;
}

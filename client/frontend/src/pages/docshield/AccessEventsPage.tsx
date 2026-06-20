import { useEffect, useState } from "react";
import { api, type AccessEvent } from "@/lib/docshield-api";
import { mockAccessEvents } from "@/lib/docshield-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AccessEventsPage() {
  const [events, setEvents] = useState<AccessEvent[]>(mockAccessEvents);
  const [documentId, setDocumentId] = useState("");
  const [linkId, setLinkId] = useState("");
  const [country, setCountry] = useState("US");
  const [action, setAction] = useState<AccessEvent["action"]>("opened");

  useEffect(() => {}, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ev: AccessEvent = {
      document_id: documentId,
      link_id: linkId,
      timestamp: new Date().toISOString(),
      ip_hash: `h:${Math.random().toString(16).slice(2, 6)}…`,
      user_agent_hash: `h:${Math.random().toString(16).slice(2, 6)}…`,
      country,
      action,
    };
    try {
      const saved = await api.logAccessEvent(ev);
      setEvents((e) => [saved, ...e]);
      toast.success("Access event logged");
    } catch {
      setEvents((e) => [{ ...ev, event_id: `ae_${Math.random().toString(16).slice(2, 6)}` }, ...e]);
      toast.message("Saved locally", { description: "POST /access-events not reachable." });
    }
    setDocumentId("");
    setLinkId("");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Access events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log secure-link opens, downloads, and failures via <code>POST /access-events</code>.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5 grid md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Document ID</Label>
          <Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="doc_…" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link ID</Label>
          <Input value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="lnk_…" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={action} onValueChange={(v) => setAction(v as AccessEvent["action"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opened">opened</SelectItem>
              <SelectItem value="downloaded">downloaded</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <Button type="submit">Log event</Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Time</th>
              <th className="text-left px-4 py-2 font-medium">Document</th>
              <th className="text-left px-4 py-2 font-medium">Link</th>
              <th className="text-left px-4 py-2 font-medium">Country</th>
              <th className="text-left px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e, i) => (
              <tr key={e.event_id ?? i}>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.document_id}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.link_id}</td>
                <td className="px-4 py-3">{e.country}</td>
                <td className="px-4 py-3">
                  <Badge variant={e.action === "failed" ? "destructive" : e.action === "downloaded" ? "default" : "secondary"}>
                    {e.action}
                  </Badge>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No events.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

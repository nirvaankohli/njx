import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type HistoryEvent, type DocumentManifest } from "@/lib/docshield-api";
import { mockDocuments, mockHistory } from "@/lib/docshield-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

const ACTIONS = ["issued", "sent", "received", "confirmed", "approved", "reissued"] as const;

export default function DocumentDetailPage() {
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const [doc, setDoc] = useState<DocumentManifest | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [action, setAction] = useState<typeof ACTIONS[number]>("sent");
  const [actorOrg, setActorOrg] = useState("");
  const [keyId, setKeyId] = useState("");
  const [signature, setSignature] = useState("");

  useEffect(() => {
    setDoc(mockDocuments.find((d) => d.document_id === documentId) ?? null);
    setHistory(mockHistory[documentId] ?? []);
  }, [documentId]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    const ev: HistoryEvent = {
      action,
      actor_org: actorOrg,
      actor_key_id: keyId,
      timestamp: new Date().toISOString(),
      previous_event_hash: history.length ? `sha256:${Math.random().toString(16).slice(2, 10)}…` : undefined,
      signature,
    };
    try {
      const saved = await api.addHistory(documentId, ev);
      setHistory((h) => [...h, saved]);
      toast.success("History event appended");
    } catch {
      setHistory((h) => [...h, { ...ev, event_id: `evt_${Math.random().toString(16).slice(2, 8)}` }]);
      toast.message("Saved locally", { description: "POST /documents/{id}/events not reachable." });
    }
    setShowForm(false);
    setActorOrg("");
    setKeyId("");
    setSignature("");
  }

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All documents
      </Link>

      <header>
        <div className="font-mono text-sm text-muted-foreground">{documentId}</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Document passport</h1>
      </header>

      {doc && (
        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Tenant" value={doc.tenant_id} />
            <Field label="Status" value={doc.status ?? "active"} />
            <Field label="Fingerprint" value={doc.content_fingerprint} mono />
            <Field label="Signers" value={doc.signer_refs.join(", ") || "—"} mono />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Policy</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">external_ai: {doc.policy.external_ai_upload}</Badge>
              <Badge variant="secondary">secure_link: {String(doc.policy.secure_link_required)}</Badge>
              <Badge variant="secondary">forwarding: {doc.policy.forwarding}</Badge>
              <Badge variant="secondary">public_sharing: {doc.policy.public_sharing}</Badge>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Embedded AI tags</div>
            <div className="flex flex-wrap gap-2">
              {doc.embedded_ai_tags.map((t) => (
                <Badge key={t} className="font-mono text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Signing history</h2>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Append event
          </Button>
        </div>

        {showForm && (
          <form onSubmit={addEvent} className="rounded-lg border border-border bg-card p-5 space-y-4 mb-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as typeof ACTIONS[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Actor org</Label>
                <Input value={actorOrg} onChange={(e) => setActorOrg(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Actor key ID</Label>
                <Input value={keyId} onChange={(e) => setKeyId(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Signature</Label>
                <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="ed25519:…" required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Append</Button>
            </div>
          </form>
        )}

        <ol className="relative border-l border-border ml-2 space-y-5">
          {history.map((e, i) => (
            <li key={e.event_id ?? i} className="ml-5">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">{e.action}</Badge>
                <span className="text-sm">{e.actor_org}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-mono break-all">
                key={e.actor_key_id} · sig={e.signature}
              </div>
            </li>
          ))}
          {history.length === 0 && (
            <li className="ml-5 text-sm text-muted-foreground">No history events yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DocumentManifest, type AiTag } from "@/lib/docshield-api";
import { mockDocuments } from "@/lib/docshield-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

const ALL_TAGS: AiTag[] = ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY", "NO_FORWARDING", "PUBLIC_SHARING_BLOCKED"];

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentManifest[]>(mockDocuments);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [docId, setDocId] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [tenantId, setTenantId] = useState("tenant_acme");
  const [signerRefs, setSignerRefs] = useState("");
  const [blockAi, setBlockAi] = useState(true);
  const [secureLink, setSecureLink] = useState(true);
  const [blockForward, setBlockForward] = useState(true);
  const [blockPublic, setBlockPublic] = useState(true);
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  useEffect(() => {
    // No GET endpoint defined; keep mock as the source of recent registrations.
  }, []);

  function toggleTag(t: AiTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      document_id: docId || `doc_${Math.random().toString(16).slice(2, 10)}`,
      tenant_id: tenantId,
      content_fingerprint: fingerprint,
      policy: {
        external_ai_upload: (blockAi ? "blocked" : "allowed") as "blocked" | "allowed",
        secure_link_required: secureLink,
        forwarding: (blockForward ? "blocked" : "allowed") as "blocked" | "allowed",
        public_sharing: (blockPublic ? "blocked" : "allowed") as "blocked" | "allowed",
      },
      embedded_ai_tags: tags,
      signer_refs: signerRefs.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      const created = await api.registerDocument(payload);
      setDocs((d) => [created, ...d]);
      toast.success("Document registered", { description: created.document_id });
    } catch {
      const local: DocumentManifest = {
        ...payload,
        created_at: new Date().toISOString(),
        status: "active",
      };
      setDocs((d) => [local, ...d]);
      toast.message("Saved locally", {
        description: "POST /documents not reachable — manifest stored in this session.",
      });
    }
    setShowForm(false);
    setDocId("");
    setFingerprint("");
    setSignerRefs("");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a manifest by posting hash, policy, AI tags, and signer references to <code>POST /documents</code>.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Register document
        </Button>
      </header>

      {showForm && (
        <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Document ID (optional)</Label>
              <Input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="doc_…" />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Content fingerprint</Label>
              <Input
                value={fingerprint}
                onChange={(e) => setFingerprint(e.target.value)}
                placeholder="sha256:…  (computed inside customer environment)"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Signer key IDs (comma separated)</Label>
              <Input value={signerRefs} onChange={(e) => setSignerRefs(e.target.value)} placeholder="key_supplierco_01, key_buyerco_02" />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-3">Policy</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <PolicyRow label="Block external AI upload" value={blockAi} onChange={setBlockAi} />
              <PolicyRow label="Secure link required" value={secureLink} onChange={setSecureLink} />
              <PolicyRow label="Block forwarding" value={blockForward} onChange={setBlockForward} />
              <PolicyRow label="Block public sharing" value={blockPublic} onChange={setBlockPublic} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-3">Embedded AI tags</div>
            <div className="flex flex-wrap gap-3">
              {ALL_TAGS.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm rounded-md border border-border px-3 py-2 cursor-pointer">
                  <Checkbox checked={tags.includes(t)} onCheckedChange={() => toggleTag(t)} />
                  <span className="font-mono text-xs">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit">Register</Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-border divide-y divide-border bg-card">
        {docs.map((d) => (
          <Link
            key={d.document_id}
            to={`/app/documents/${encodeURIComponent(d.document_id)}`}
            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-mono text-sm truncate">{d.document_id}</div>
                <div className="text-xs text-muted-foreground truncate">{d.content_fingerprint}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {d.embedded_ai_tags.slice(0, 2).map((t) => (
                <Badge key={t} variant="secondary" className="font-mono text-[10px]">{t}</Badge>
              ))}
              <Badge variant={d.status === "revoked" ? "destructive" : "default"}>
                {d.status ?? "active"}
              </Badge>
            </div>
          </Link>
        ))}
        {docs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No documents yet.</div>}
      </div>
    </div>
  );
}

function PolicyRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

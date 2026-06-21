import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Copy, Link2, Loader2, Plus } from "lucide-react";
import {
  api,
  type DocumentManifest,
  type ShareAnalytics,
  type SignedHistoryEventPayload,
} from "@/lib/docshield-api";
import { mockDocuments, mockHistory } from "@/lib/docshield-mock";
import { formatFileSize } from "@/lib/docshield-file";
import { ensureDevSigningIdentity, signCanonicalPayload, toBackendIsoString } from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ACTIONS = ["issued", "sent", "received", "confirmed_received", "approved", "reissued", "revoked"] as const;

export default function DocumentDetailPage() {
  const session = getDocShieldSession();
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const activeDocumentId = session.activeDocument?.documentId ?? null;
  const activeDocumentFingerprint = session.activeDocument?.contentFingerprint ?? null;
  const activeDocumentHistoryTip = session.activeDocument?.historyTip ?? null;
  const activeDocumentManifestHash = session.activeDocument?.manifestHash ?? null;
  const [doc, setDoc] = useState<DocumentManifest | null>(null);
  const [history, setHistory] = useState<SignedHistoryEventPayload[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [analytics, setAnalytics] = useState<ShareAnalytics | null>(null);

  const [action, setAction] = useState<typeof ACTIONS[number]>("sent");
  const [actorOrg, setActorOrg] = useState("BuyerCo");
  const [keyId, setKeyId] = useState(session.issuerKeyId);
  const [signature, setSignature] = useState("");
  const [payloadNote, setPayloadNote] = useState("Buyer confirmed receipt");

  // The session object is rehydrated on every render, so we key the effect off
  // stable primitives to avoid a refetch/render loop while still reacting to
  // active document changes.
  useEffect(() => {
    if (activeDocumentId === documentId && session.activeDocument) {
      setDoc({
        document_id: session.activeDocument.documentId,
        tenant_id: session.tenantId,
        content_fingerprint: activeDocumentFingerprint ?? session.activeDocument.contentFingerprint,
        policy: session.activeDocument.signedManifest.manifest.policy,
        embedded_ai_tags: session.activeDocument.signedManifest.manifest.embedded_ai_tags,
        signer_refs: [session.issuerKeyId],
        created_at: session.activeDocument.signedManifest.manifest.created_at,
        status: "active",
      });
      setHistory(session.activeDocument.history);
      return;
    }

    const localDocument = mockDocuments.find((entry) => entry.document_id === documentId) ?? null;
    setDoc(localDocument);
    setHistory(mockHistory[documentId] ?? []);
  }, [
    documentId,
    activeDocumentId,
    activeDocumentFingerprint,
    activeDocumentHistoryTip,
    activeDocumentManifestHash,
    session.activeDocument?.sourceFileName,
    session.activeDocument?.sourceFileType,
    session.activeDocument?.sourceFileSize,
    session.issuerKeyId,
    session.tenantId,
  ]);

  const manifestHash = useMemo(() => activeDocumentManifestHash ?? `sha256:${documentId}`, [documentId, activeDocumentManifestHash]);
  const previousEventHash = activeDocumentHistoryTip;
  const shareLink = session.activeDocument?.documentId === documentId ? session.activeDocument.shareLink : null;
  const shareUrl = shareLink ? `${window.location.origin}/s/${shareLink.token}` : null;

  useEffect(() => {
    if (activeDocumentId !== documentId) return;
    api.shareAnalytics(documentId).then(setAnalytics).catch(() => setAnalytics(null));
  }, [activeDocumentId, documentId, shareLink?.linkId]);

  async function createSecureLink() {
    if (!session.activeDocument || session.activeDocument.documentId !== documentId) return;
    setSharingBusy(true);
    try {
      const method = session.activeDocument.accessAnyoneWithLink
        ? "link"
        : session.activeDocument.accessMethod ?? "organization";
      const link = await api.createShareLink(documentId, {
        access_method: method,
        password_hash: session.activeDocument.accessPasswordHash,
        expires_in_hours: 168,
      });
      updateDocShieldSession({
        activeDocument: {
          ...session.activeDocument,
          shareLink: { linkId: link.link_id, token: link.token, expiresAt: link.expires_at },
        },
      });
      toast.success("Secure link created", { description: "It expires in seven days and every access is tracked." });
    } catch (error) {
      toast.error("Could not create secure link", {
        description: error instanceof Error ? error.message : "The sharing service is unavailable.",
      });
    } finally {
      setSharingBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Secure link copied");
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;

    setBusy(true);
    try {
      await ensureDevSigningIdentity();
      const timestamp = toBackendIsoString();
      const eventBase = {
        event_id: `evt_${Math.random().toString(16).slice(2, 8)}`,
        document_id: documentId,
        event: action,
        actor_org: actorOrg,
        actor_key_id: keyId,
        timestamp,
        previous_event_hash: previousEventHash,
        manifest_hash: manifestHash,
        payload: payloadNote ? { note: payloadNote } : {},
      };
      const signedEvent: SignedHistoryEventPayload = {
        ...eventBase,
        signature: signature || (await signCanonicalPayload(eventBase)),
      };
      const response = await api.addHistory(documentId, signedEvent);
      setHistory((current) => [...current, signedEvent]);
      updateDocShieldSession({
        activeDocument: session.activeDocument
          ? {
              ...session.activeDocument,
              historyTip: response.history_tip,
              history: [...session.activeDocument.history, signedEvent],
            }
          : session.activeDocument,
      });
      setSignature("");
      setPayloadNote("");
      toast.success("History event appended", { description: response.event_id });
    } catch (err) {
      toast.error("Could not append event", {
        description: err instanceof Error ? err.message : "POST /documents/{id}/events not reachable",
      });
    } finally {
      setBusy(false);
      setShowForm(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        All documents
      </Link>

      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">{documentId}</div>
        <h1 className="text-2xl font-semibold tracking-tight">Document passport</h1>
      </header>

      {doc ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manifest summary</CardTitle>
            <CardDescription>Current document state and policy controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tenant" value={doc.tenant_id} />
              <Field label="Status" value={doc.status ?? "active"} />
              <Field label="Fingerprint" value={doc.content_fingerprint} mono />
              <Field label="Signers" value={doc.signer_refs.join(", ") || "—"} mono />
              <Field label="Source file" value={session.activeDocument?.sourceFileName ?? "—"} />
              <Field
                label="Source type"
                value={
                  session.activeDocument?.sourceFileType
                    ? `${session.activeDocument.sourceFileType}${session.activeDocument.sourceFileSize ? ` · ${formatFileSize(session.activeDocument.sourceFileSize)}` : ""}`
                    : "—"
                }
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Policy</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">external_ai: {doc.policy.external_ai_upload}</Badge>
                <Badge variant="secondary">secure_link: {String(doc.policy.secure_link_required)}</Badge>
                <Badge variant="secondary">forwarding: {doc.policy.forwarding}</Badge>
                <Badge variant="secondary">public_sharing: {doc.policy.public_sharing}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Embedded AI tags</div>
              <div className="flex flex-wrap gap-2">
                {doc.embedded_ai_tags.map((tag) => (
                  <Badge key={tag} className="font-mono text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Document not found.</CardContent>
        </Card>
      )}

      {doc && activeDocumentId === documentId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Secure sharing</CardTitle>
            <CardDescription>Create a random, expiring link. Raw tokens are never stored by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {shareUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={shareUrl} readOnly className="font-mono text-xs" aria-label="Secure share link" />
                <Button onClick={() => void copyShareLink()}><Copy className="mr-2 h-4 w-4" />Copy</Button>
              </div>
            ) : (
              <Button onClick={() => void createSecureLink()} disabled={sharingBusy}>
                {sharingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Generate secure link
              </Button>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Link opens" value={analytics?.opens ?? 0} />
              <Metric label="Downloads" value={analytics?.downloads ?? 0} />
              <Metric label="Countries" value={Object.keys(analytics?.countries ?? {}).length} />
            </div>
            {analytics && Object.keys(analytics.countries).length > 0 && (
              <div className="flex flex-wrap gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                {Object.entries(analytics.countries).map(([country, count]) => <Badge key={country} variant="outline">{country}: {count}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Signing history</h2>
            <p className="text-sm text-muted-foreground">Append a signed event to the document chain.</p>
          </div>
          <Button size="sm" onClick={() => setShowForm((value) => !value)}>
            <Plus className="mr-1 h-4 w-4" />
            Append event
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Append a signed event</CardTitle>
              <CardDescription>The payload is signed in-browser before the backend sees it.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addEvent} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={action} onValueChange={(value) => setAction(value as typeof ACTIONS[number])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
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
                    <Label>Signature override</Label>
                    <Input
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Leave blank to sign automatically"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payload note</Label>
                  <Textarea
                    value={payloadNote}
                    onChange={(e) => setPayloadNote(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || !doc}>
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Append
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="relative space-y-4 border-l border-border pl-5">
          {history.map((event) => (
            <div key={event.event_id} className="relative">
              <span className="absolute -left-[29px] top-2 h-3 w-3 rounded-full bg-primary" />
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {event.event}
                      </Badge>
                      <span className="text-sm">{event.actor_org}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="font-mono break-all">key={event.actor_key_id}</div>
                  <div className="font-mono break-all">sig={event.signature}</div>
                  <div className="font-mono break-all">manifest={event.manifest_hash}</div>
                </CardContent>
              </Card>
            </div>
          ))}
          {history.length === 0 && <div className="text-sm text-muted-foreground">No history events yet.</div>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>;
}

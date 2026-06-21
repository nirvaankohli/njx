import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Copy, Link2, Loader2, Plus } from "lucide-react";
import {
  api,
  type DocumentDetail,
  type DocumentManifest,
  type ShareAnalytics,
  type SignedHistoryEventPayload,
} from "@/lib/docshield-api";
import { formatFileSize } from "@/lib/docshield-file";
import { ensureDevSigningIdentity, signCanonicalPayload, toBackendIsoString } from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { humanizeDocShieldLabel } from "@/lib/docshield-labels";
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
  const [details, setDetails] = useState<DocumentDetail | null>(null);
  const [history, setHistory] = useState<SignedHistoryEventPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [analytics, setAnalytics] = useState<ShareAnalytics | null>(null);

  const [action, setAction] = useState<typeof ACTIONS[number]>("sent");
  const [actorOrg, setActorOrg] = useState("BuyerCo");
  const [keyId, setKeyId] = useState(session.issuerKeyId);
  const [signature, setSignature] = useState("");
  const [payloadNote, setPayloadNote] = useState("Buyer confirmed receipt");

  useEffect(() => {
    let cancelled = false;
    const activeDocument = getDocShieldSession().activeDocument;
    setLoading(true);
    setLoadError(null);

    if (activeDocumentId === documentId && activeDocument) {
      setDoc({
        document_id: activeDocument.documentId,
        tenant_id: session.tenantId,
        content_fingerprint: activeDocumentFingerprint ?? activeDocument.contentFingerprint,
        policy: activeDocument.signedManifest.manifest.policy,
        embedded_ai_tags: activeDocument.signedManifest.manifest.embedded_ai_tags,
        signer_refs: [session.issuerKeyId],
        created_at: activeDocument.signedManifest.manifest.created_at,
        status: "active",
      });
      setHistory(activeDocument.history);
    }

    void api
      .document(documentId, session.tenantId)
      .then((document) => {
        if (cancelled) return;
        setDetails(document);
        setDoc({
          document_id: document.document_id,
          tenant_id: document.tenant_id,
          content_fingerprint: document.content_fingerprint,
          policy: document.policy,
          embedded_ai_tags: document.embedded_ai_tags,
          signer_refs: [document.issuer_key_id],
          created_at: document.created_at,
          status: document.status,
        });
        setHistory(document.history);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDetails(null);
        setLoadError(error instanceof Error ? error.message : "Document service unavailable");
        if (activeDocumentId !== documentId) {
          setDoc(null);
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

  const manifestHash = useMemo(
    () => details?.manifest_hash ?? activeDocumentManifestHash ?? `sha256:${documentId}`,
    [documentId, activeDocumentManifestHash, details?.manifest_hash],
  );
  const previousEventHash = details?.history_tip ?? activeDocumentHistoryTip;
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
      setDetails((current) => current
        ? { ...current, history_tip: response.history_tip, history: [...current.history, signedEvent], event_count: current.event_count + 1 }
        : current);
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
        description: err instanceof Error ? err.message : "Post /documents/{id}/events not reachable",
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

      {loading && !doc ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
          </CardContent>
        </Card>
      ) : doc ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manifest summary</CardTitle>
            <CardDescription>Current document state and policy controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tenant" value={doc.tenant_id} />
              <Field label="Status" value={doc.status ?? "active"} />
              <Field label="Fingerprint" value={doc.content_fingerprint} />
              <Field label="Signers" value={doc.signer_refs.join(", ") || "—"} />
              <Field label="Source file" value={details?.file_name ?? session.activeDocument?.sourceFileName ?? "—"} />
              <Field
                label="Source type"
                value={
                  details?.content_type
                    ? `${details.content_type}${details.size_bytes != null ? ` · ${formatFileSize(details.size_bytes)}` : ""}`
                    : session.activeDocument?.sourceFileType
                    ? `${session.activeDocument.sourceFileType}${session.activeDocument.sourceFileSize ? ` · ${formatFileSize(session.activeDocument.sourceFileSize)}` : ""}`
                    : "—"
                }
              />
              <Field label="History events" value={String(details?.event_count ?? history.length)} />
              <Field label="Access" value={details?.access_method ?? "Not configured"} />
            </div>
            <div>
              <div className="text-xs tracking-[0.16em] text-muted-foreground mb-2">Policy</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">external_ai: {doc.policy.external_ai_upload}</Badge>
                <Badge variant="secondary">secure_link: {String(doc.policy.secure_link_required)}</Badge>
                <Badge variant="secondary">forwarding: {doc.policy.forwarding}</Badge>
                <Badge variant="secondary">public_sharing: {doc.policy.public_sharing}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs tracking-[0.16em] text-muted-foreground mb-2">Embedded Ai tags</div>
              <div className="flex flex-wrap gap-2">
                {doc.embedded_ai_tags.map((tag) => (
                  <Badge key={tag} className="text-[10px] font-medium tracking-[0.08em]">
                    {humanizeDocShieldLabel(tag)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground" role="alert">
            Document not found.{loadError ? ` ${loadError}` : ""}
          </CardContent>
        </Card>
      )}

      {doc && loadError && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          Showing the browser-session copy because the document service could not be reached. {loadError}
        </div>
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
              <Metric label="Download rate / hr" value={analytics?.download_rate_per_hour?.toFixed(1) ?? "0.0"} />
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
                      <Badge variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                        {humanizeDocShieldLabel(event.event)}
                      </Badge>
                      <span className="text-sm">{event.actor_org}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="break-all text-sm text-foreground">key={event.actor_key_id}</div>
                  <div className="break-all text-sm text-foreground">sig={event.signature}</div>
                  <div className="break-all text-sm text-foreground">manifest={event.manifest_hash}</div>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm text-foreground">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>;
}

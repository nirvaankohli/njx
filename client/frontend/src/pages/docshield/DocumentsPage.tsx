import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CircleAlert, FileText, Loader2, ShieldCheck } from "lucide-react";
import { api, type AiTag, type DocumentManifest, type SignedHistoryEventPayload, type SignedManifestPayload } from "@/lib/docshield-api";
import { mockDocuments } from "@/lib/docshield-mock";
import {
  ensureDevSigningIdentity,
  canonicalJsonString,
  sha256Hex,
  signCanonicalPayload,
  toBackendIsoString,
} from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const ALL_TAGS: AiTag[] = ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY", "NO_FORWARDING", "PUBLIC_SHARING_BLOCKED"];

type LocalDocument = DocumentManifest & {
  manifestHash: string;
  historyTip: string;
  signedManifest: SignedManifestPayload;
  initialHistory: SignedHistoryEventPayload[];
};

export default function DocumentsPage() {
  const session = getDocShieldSession();
  const [docs, setDocs] = useState<LocalDocument[]>(
    mockDocuments.map((doc) => ({
      ...doc,
      manifestHash: `sha256:${doc.document_id}`,
      historyTip: `sha256:${doc.document_id}-tip`,
      signedManifest: {
        manifest: {
          schema_version: "1.0",
          tenant_id: doc.tenant_id,
          document_id: doc.document_id,
          issuer_key_id: session.issuerKeyId,
          content_fingerprint: doc.content_fingerprint,
          policy: doc.policy,
          embedded_ai_tags: doc.embedded_ai_tags,
          created_at: doc.created_at ?? new Date().toISOString(),
        },
        manifest_signature: "ed25519:demo",
        signature_algorithm: "Ed25519",
      },
      initialHistory: [],
    })),
  );
  const [busy, setBusy] = useState(false);

  const [docId, setDocId] = useState(session.activeDocument?.documentId ?? "");
  const [tenantId, setTenantId] = useState(session.tenantId);
  const [issuerKeyId, setIssuerKeyId] = useState(session.issuerKeyId);
  const [fingerprint, setFingerprint] = useState(session.activeDocument?.contentFingerprint ?? "");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [actorOrg, setActorOrg] = useState(session.tenantName || "SupplierCo");
  const [signerRefs, setSignerRefs] = useState(issuerKeyId);
  const [blockAi, setBlockAi] = useState(true);
  const [secureLink, setSecureLink] = useState(true);
  const [blockForward, setBlockForward] = useState(true);
  const [blockPublic, setBlockPublic] = useState(true);
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  function toggleTag(tag: AiTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]));
  }

  async function selectDocument(file: File | null) {
    setDocumentFile(file);
    if (!file) {
      setFingerprint("");
      return;
    }
    if (!docId) {
      setDocId(`doc_${file.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}`);
    }
    setFingerprint(await sha256Hex(await file.arrayBuffer()));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      await ensureDevSigningIdentity();
      const createdAt = toBackendIsoString();
      const manifest = {
        schema_version: "1.0",
        tenant_id: tenantId,
        document_id: docId || `doc_${Math.random().toString(16).slice(2, 10)}`,
        issuer_key_id: issuerKeyId,
        content_fingerprint: fingerprint,
        policy: {
          external_ai_upload: blockAi ? "blocked" : "allowed",
          secure_link_required: secureLink,
          forwarding: blockForward ? "blocked" : "allowed",
          public_sharing: blockPublic ? "blocked" : "allowed",
        } as const,
        embedded_ai_tags: tags,
        created_at: createdAt,
      };

      const manifestHash = await sha256Hex(canonicalJsonString(manifest));
      const signedManifest: SignedManifestPayload = {
        manifest,
        manifest_signature: await signCanonicalPayload(manifest),
        signature_algorithm: "Ed25519",
      };

      const initialEventBase = {
        event_id: "evt_issued_001",
        document_id: manifest.document_id,
        event: "issued" as const,
        actor_org: actorOrg,
        actor_key_id: issuerKeyId,
        timestamp: createdAt,
        previous_event_hash: null,
        manifest_hash: manifestHash,
        payload: {},
      };
      const initialEvent: SignedHistoryEventPayload = {
        ...initialEventBase,
        signature: await signCanonicalPayload(initialEventBase),
      };

      const response = await api.registerDocument({
        signed_manifest: signedManifest,
        initial_history: [initialEvent],
      });
      const parsedSignerRefs = signerRefs.split(",").map((value) => value.trim()).filter(Boolean);

      const nextDocument: LocalDocument = {
        document_id: manifest.document_id,
        tenant_id: tenantId,
        content_fingerprint: fingerprint,
        policy: manifest.policy,
        embedded_ai_tags: tags,
        signer_refs: parsedSignerRefs.length > 0 ? parsedSignerRefs : [issuerKeyId],
        created_at: createdAt,
        status: "active",
        manifestHash: response.manifest_hash,
        historyTip: response.history_tip,
        signedManifest,
        initialHistory: [initialEvent],
      };

      setDocs((current) => [nextDocument, ...current.filter((doc) => doc.document_id !== nextDocument.document_id)]);
      setDocId("");
      setFingerprint("");
      updateDocShieldSession({
        tenantId,
        tenantName: session.tenantName,
        issuerKeyId,
        activeDocument: {
          documentId: nextDocument.document_id,
          contentFingerprint: fingerprint,
          manifestHash: response.manifest_hash,
          historyTip: response.history_tip,
          signedManifest,
          history: [initialEvent],
        },
      });
      setDocId(nextDocument.document_id);
      setSignerRefs(issuerKeyId);
      toast.success("Document registered", { description: `${response.document_id} is ready for verify and telemetry.` });
    } catch (err) {
      toast.error("Document registration failed", {
        description: err instanceof Error ? err.message : "POST /documents not reachable",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            Signed flow
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Backend aligned
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload a document once, sign it locally, and keep the audit trail ready for verify and review.
        </p>
      </header>

      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Signatures are created in your browser</AlertTitle>
        <AlertDescription>
          The browser stores a dev Ed25519 keypair, signs the manifest and first history event, and sends the exact
          payloads the backend expects.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload and register</CardTitle>
            <CardDescription>
              Fill in the upload details once, and we’ll handle the signing and audit trail for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Document ID</Label>
                  <Input
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    placeholder="employee-handbook-v3"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Issuer key ID</Label>
                  <Input value={issuerKeyId} onChange={(e) => setIssuerKeyId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Signer refs</Label>
                  <Input value={signerRefs} onChange={(e) => setSignerRefs(e.target.value)} placeholder="key_acme_primary" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="document-file">Document file</Label>
                  <Input
                    id="document-file"
                    type="file"
                    onChange={(event) => void selectDocument(event.target.files?.[0] ?? null)}
                    required
                  />
                  {documentFile && (
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {documentFile.name} · {fingerprint || "Calculating SHA-256…"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Uploaded by</Label>
                  <Input value={actorOrg} onChange={(e) => setActorOrg(e.target.value)} required />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium">Access rules</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PolicyRow label="Block external AI tools" value={blockAi} onChange={setBlockAi} />
                  <PolicyRow label="Require secure links" value={secureLink} onChange={setSecureLink} />
                  <PolicyRow label="Block forwarding" value={blockForward} onChange={setBlockForward} />
                  <PolicyRow label="Block public sharing" value={blockPublic} onChange={setBlockPublic} />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-3">Embedded AI tags</div>
                <div className="flex flex-wrap gap-3">
                  {ALL_TAGS.map((tag) => (
                    <label key={tag} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                      <span className="font-mono text-xs">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  The manifest signature, history event signature, and manifest hash are generated before submit.
                </p>
                <Button type="submit" disabled={busy || !fingerprint}>
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Register upload
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace context</CardTitle>
              <CardDescription>The current organization and active document stay in your browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Organization" value={session.tenantName} />
              <Row label="Signing key" value={session.issuerKeyId} mono />
              <Row label="Current document" value={session.activeDocument?.documentId ?? "None"} mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded documents</CardTitle>
              <CardDescription>Locally remembered entries, since the backend does not expose a list endpoint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {docs.map((doc) => (
                <Link
                  key={doc.document_id}
                  to={`/app/documents/${encodeURIComponent(doc.document_id)}`}
                  className="block rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/40 hover:bg-secondary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="truncate font-medium">{doc.document_id}</div>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{doc.content_fingerprint}</div>
                    </div>
                    <Badge variant={doc.status === "revoked" ? "destructive" : "secondary"}>{doc.status ?? "active"}</Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    {doc.embedded_ai_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="font-mono text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}

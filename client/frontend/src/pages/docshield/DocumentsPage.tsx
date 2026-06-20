import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CircleAlert,
  Download,
  FileSignature,
  FileText,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  api,
  type AiTag,
  type DocumentManifest,
  type SignedHistoryEventPayload,
  type SignedManifestPayload,
} from "@/lib/docshield-api";
import { mockDocuments } from "@/lib/docshield-mock";
import {
  buildDocumentId,
  fingerprintDocumentFile,
  formatFileSize,
  inferDocumentMimeType,
  isSupportedDocumentFile,
} from "@/lib/docshield-file";
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
  sourceFileName?: string;
  sourceFileType?: string;
  sourceFileSize?: number;
};

type SignedPackageSummary = {
  fileName: string;
  fileType: string;
  fileSize: number;
  documentId: string;
  fingerprint: string;
  manifestHash: string;
  createdAt: string;
  downloadName: string;
  packageUrl: string;
  backendStatus: "registered" | "local-only";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signedPackage, setSignedPackage] = useState<SignedPackageSummary | null>(null);
  const [tenantId, setTenantId] = useState(session.tenantId);
  const [issuerKeyId, setIssuerKeyId] = useState(session.issuerKeyId);
  const [actorOrg, setActorOrg] = useState(session.tenantName || "SupplierCo");
  const [signerRefs, setSignerRefs] = useState(session.issuerKeyId);
  const [blockAi, setBlockAi] = useState(true);
  const [secureLink, setSecureLink] = useState(true);
  const [blockForward, setBlockForward] = useState(true);
  const [blockPublic, setBlockPublic] = useState(true);
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  useEffect(
    () => () => {
      if (signedPackage?.packageUrl) {
        URL.revokeObjectURL(signedPackage.packageUrl);
      }
    },
    [signedPackage?.packageUrl],
  );

  function toggleTag(tag: AiTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]));
  }

  async function signDocument(file: File) {
    if (busy) return;
    if (!isSupportedDocumentFile(file)) {
      toast.error("Unsupported file type", {
        description: "Upload a PDF or DOCX file to sign and register it.",
      });
      return;
    }

    setBusy(true);
    setSelectedFile(file);
    setSignedPackage(null);

    try {
      await ensureDevSigningIdentity();
      const fileType = inferDocumentMimeType(file);
      const fingerprint = await fingerprintDocumentFile(file);
      const createdAt = toBackendIsoString();
      const documentId = buildDocumentId(file.name, fingerprint);
      const manifest = {
        schema_version: "1.0",
        tenant_id: tenantId,
        document_id: documentId,
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

      const packagePayload = {
        source_file: {
          name: file.name,
          type: fileType,
          size: file.size,
        },
        signed_manifest: signedManifest,
        initial_history: [initialEvent],
        manifest_hash: manifestHash,
        signed_at: createdAt,
      };
      const packageUrl = URL.createObjectURL(
        new Blob([JSON.stringify(packagePayload, null, 2)], { type: "application/json" }),
      );
      const downloadName = `${file.name.replace(/\.[^.]+$/, "")}.docshield.json`;

      setSignedPackage({
        fileName: file.name,
        fileType,
        fileSize: file.size,
        documentId,
        fingerprint,
        manifestHash,
        createdAt,
        downloadName,
        packageUrl,
        backendStatus: "local-only",
      });

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
        sourceFileName: file.name,
        sourceFileType: fileType,
        sourceFileSize: file.size,
      };

      setDocs((current) => [nextDocument, ...current.filter((doc) => doc.document_id !== nextDocument.document_id)]);
      setSignedPackage((current) => (current ? { ...current, backendStatus: "registered" } : current));
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
          sourceFileName: file.name,
          sourceFileType: fileType,
          sourceFileSize: file.size,
        },
      });
      setSignerRefs(issuerKeyId);
      toast.success("Document signed", {
        description: `${file.name} is now registered as ${response.document_id}.`,
      });
    } catch (err) {
      toast.error("Document signing failed", {
        description: err instanceof Error ? err.message : "POST /documents not reachable",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    await signDocument(file);
    e.target.value = "";
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
          Upload a PDF or DOCX, sign it locally, and keep the audit trail ready for verify and review.
        </p>
      </header>

      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Signing happens before the backend sees anything</AlertTitle>
        <AlertDescription>
          The browser stores a dev Ed25519 keypair, hashes the uploaded file locally, signs the manifest and first
          history event, and sends the exact payloads the backend expects.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Upload and sign
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileSignature className="h-3.5 w-3.5" />
                  PDF and DOCX
                </Badge>
              </div>
              <CardTitle>Drop a file, get a signed passport</CardTitle>
              <CardDescription>
                Pick a document and we’ll hash it, sign the manifest, and register the passport in one pass.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label
                htmlFor="doc-upload"
                className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-gradient-to-b from-background to-muted/50 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/70"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 max-w-md space-y-2">
                  <div className="text-lg font-medium">Choose a PDF or DOCX</div>
                  <p className="text-sm text-muted-foreground">
                    The file stays local while we build the signed manifest and history chain.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported types: PDF, DOCX. The browser computes the content fingerprint before upload.
                  </p>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Signed result appears automatically after selection
                </div>
              </label>
              <Input
                id="doc-upload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileChange}
                disabled={busy}
              />

              {selectedFile && (
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected file</div>
                      <div className="mt-1 text-base font-medium">{selectedFile.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)} · {inferDocumentMimeType(selectedFile)}
                      </div>
                    </div>
                    {busy ? (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Signing
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Ready to re-sign
                      </Badge>
                    )}
                  </div>
                  {signedPackage && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SignedField label="Document ID" value={signedPackage.documentId} mono />
                      <SignedField label="Fingerprint" value={signedPackage.fingerprint} mono />
                      <SignedField label="Manifest hash" value={signedPackage.manifestHash} mono />
                      <SignedField label="Signed at" value={signedPackage.createdAt} mono />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void signDocument(selectedFile)}
                      disabled={busy}
                    >
                      {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Re-sign this file
                    </Button>
                    {signedPackage?.packageUrl && (
                      <Button asChild size="sm">
                        <a href={signedPackage.packageUrl} download={signedPackage.downloadName}>
                          <Download className="mr-1.5 h-4 w-4" />
                          Download signed package
                        </a>
                      </Button>
                    )}
                    {signedPackage?.backendStatus === "registered" && session.activeDocument?.documentId && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/app/documents/${encodeURIComponent(session.activeDocument.documentId)}/download`}>
                          Open download page
                        </Link>
                      </Button>
                    )}
                  </div>
                  {signedPackage && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {signedPackage.backendStatus === "registered"
                        ? "The signed manifest was registered with the backend and is available in the document passport."
                        : "The file has been signed locally. Backend registration will update this card once it completes."}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signing settings</CardTitle>
              <CardDescription>These defaults are applied automatically when you upload a file.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Issuer key ID</Label>
                  <Input value={issuerKeyId} onChange={(e) => setIssuerKeyId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Uploaded by</Label>
                  <Input value={actorOrg} onChange={(e) => setActorOrg(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Signer refs</Label>
                  <Input
                    value={signerRefs}
                    onChange={(e) => setSignerRefs(e.target.value)}
                    placeholder="key_acme_primary"
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 text-sm font-medium">Access rules</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PolicyRow label="Block external AI tools" value={blockAi} onChange={setBlockAi} />
                  <PolicyRow label="Require secure links" value={secureLink} onChange={setSecureLink} />
                  <PolicyRow label="Block forwarding" value={blockForward} onChange={setBlockForward} />
                  <PolicyRow label="Block public sharing" value={blockPublic} onChange={setBlockPublic} />
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 text-sm font-medium">Embedded AI tags</div>
                <div className="flex flex-wrap gap-3">
                  {ALL_TAGS.map((tag) => (
                    <label key={tag} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                      <span className="font-mono text-xs">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <Row label="Current file" value={session.activeDocument?.sourceFileName ?? "None"} />
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
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {doc.sourceFileName ? `${doc.sourceFileName} · ` : ""}
                        {doc.content_fingerprint}
                      </div>
                    </div>
                    <Badge variant={doc.status === "revoked" ? "destructive" : "secondary"}>{doc.status ?? "active"}</Badge>
                  </div>
                  <Separator className="my-3" />
                  {doc.sourceFileType && (
                    <div className="mb-3 text-xs text-muted-foreground">
                      {doc.sourceFileType} {doc.sourceFileSize ? `· ${formatFileSize(doc.sourceFileSize)}` : ""}
                    </div>
                  )}
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

function SignedField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
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
      <div className={`mt-1 ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

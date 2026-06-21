import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Download, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
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
  canonicalJsonString,
  ensureDevSigningIdentity,
  sha256Hex,
  signCanonicalPayload,
  toBackendIsoString,
} from "@/lib/docshield-signing";
import { humanizeDocShieldLabel } from "@/lib/docshield-labels";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  accessAnyoneWithLink?: boolean;
  accessMethod?: "password" | "organization" | null;
};

type SignedDocumentSummary = {
  documentId: string;
  fileName: string;
  fingerprint: string;
  createdAt: string;
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
  const [signedDocument, setSignedDocument] = useState<SignedDocumentSummary | null>(null);
  const [tenantId, setTenantId] = useState(session.tenantId);
  const [signerRefs, setSignerRefs] = useState(session.issuerKeyId);
  const [actorOrg, setActorOrg] = useState(session.tenantName || "SupplierCo");
  const [fingerprint, setFingerprint] = useState("");
  const [blockAi, setBlockAi] = useState(true);
  const [anyoneWithLink, setAnyoneWithLink] = useState(true);
  const [accessMethod, setAccessMethod] = useState<"password" | "organization">("password");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPasswordConfirm, setAccessPasswordConfirm] = useState("");
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  const privateAccessEnabled = !anyoneWithLink;

  function toggleTag(tag: AiTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]));
  }

  async function handleFileSelection(file: File | null) {
    setSelectedFile(file);
    setSignedDocument(null);

    if (!file) {
      setFingerprint("");
      return;
    }

    if (!isSupportedDocumentFile(file)) {
      toast.error("Unsupported file type", {
        description: "Please choose a PDF or DOCX file.",
      });
      setSelectedFile(null);
      setFingerprint("");
      return;
    }

    setFingerprint(await fingerprintDocumentFile(file));
  }

  function handleAnyoneWithLinkChange(value: boolean) {
    setAnyoneWithLink(value);
    if (value) {
      setAccessPassword("");
      setAccessPasswordConfirm("");
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setSignedDocument(null);
    setFingerprint("");
    setAccessPassword("");
    setAccessPasswordConfirm("");
  }

  async function signDocument() {
    if (!selectedFile) {
      toast.error("Choose a file first");
      return;
    }

    if (!anyoneWithLink && accessMethod === "password" && accessPassword !== accessPasswordConfirm) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);

    try {
      await ensureDevSigningIdentity();

      const resolvedFingerprint = await fingerprintDocumentFile(selectedFile);
      const createdAt = toBackendIsoString();
      const signerList = signerRefs
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const primarySigner = signerList[0] ?? session.issuerKeyId;
      const documentId = buildDocumentId(selectedFile.name, resolvedFingerprint);
      const accessPasswordHash =
        privateAccessEnabled && accessMethod === "password" ? await sha256Hex(accessPassword.trim()) : null;

      const manifest = {
        schema_version: "1.0",
        tenant_id: tenantId.trim() || session.tenantId,
        document_id: documentId,
        issuer_key_id: primarySigner,
        content_fingerprint: resolvedFingerprint,
        policy: {
          external_ai_upload: blockAi ? "blocked" : "allowed",
          secure_link_required: privateAccessEnabled,
          forwarding: privateAccessEnabled ? "blocked" : "allowed",
          public_sharing: anyoneWithLink ? "allowed" : "blocked",
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
        actor_org: actorOrg.trim() || "Employee",
        actor_key_id: primarySigner,
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

      const nextDocument: LocalDocument = {
        document_id: manifest.document_id,
        tenant_id: manifest.tenant_id,
        content_fingerprint: resolvedFingerprint,
        policy: manifest.policy,
        embedded_ai_tags: tags,
        signer_refs: signerList.length > 0 ? signerList : [primarySigner],
        created_at: createdAt,
        status: "active",
        manifestHash: response.manifest_hash,
        historyTip: response.history_tip,
        signedManifest,
        initialHistory: [initialEvent],
        sourceFileName: selectedFile.name,
        sourceFileType: inferDocumentMimeType(selectedFile),
        sourceFileSize: selectedFile.size,
        accessAnyoneWithLink: anyoneWithLink,
        accessMethod: privateAccessEnabled ? accessMethod : null,
      };

      setDocs((current) => [nextDocument, ...current.filter((doc) => doc.document_id !== nextDocument.document_id)]);
      updateDocShieldSession({
        tenantId: manifest.tenant_id,
        tenantName: session.tenantName,
        issuerKeyId: primarySigner,
        activeDocument: {
          documentId: nextDocument.document_id,
          contentFingerprint: resolvedFingerprint,
          manifestHash: response.manifest_hash,
          historyTip: response.history_tip,
          signedManifest,
          history: [initialEvent],
          sourceFileName: selectedFile.name,
          sourceFileType: inferDocumentMimeType(selectedFile),
          sourceFileSize: selectedFile.size,
          accessAnyoneWithLink: anyoneWithLink,
          accessMethod: privateAccessEnabled ? accessMethod : null,
          accessPasswordHash,
        },
      });

      setSignedDocument({
        documentId: nextDocument.document_id,
        fileName: selectedFile.name,
        fingerprint: resolvedFingerprint,
        createdAt,
      });
      setAccessPassword("");
      setAccessPasswordConfirm("");

      toast.success("Document signed", {
        description: `${selectedFile.name} is now ready to download.`,
      });
    } catch (err) {
      toast.error("Document signing failed", {
        description: err instanceof Error ? err.message : "Post /documents not reachable",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            Employee upload
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Private access
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a file to be encrypted or signed.</h1>
        <p className="text-sm text-muted-foreground">
          Choose a PDF or DOCX, then set the access controls before signing.
        </p>
      </header>

      <div className="space-y-6">
        <Card className="overflow-hidden border-border/80 bg-gradient-to-b from-background to-muted/20 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.7)]">
          <CardHeader>
            <CardTitle className="text-base">Upload</CardTitle>
            <CardDescription>Drop a file or choose one from your device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="document-file">Document file</Label>
                  <Input
                    id="document-file"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => void handleFileSelection(event.target.files?.[0] ?? null)}
                  />
                  {selectedFile && (
                    <div className="rounded-xl border border-border bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs tracking-[0.16em] text-muted-foreground">Selected file</div>
                          <div className="mt-1 truncate text-base font-medium">{selectedFile.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {formatFileSize(selectedFile.size)} · {inferDocumentMimeType(selectedFile)}
                          </div>
                          <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                            {fingerprint || "Calculating SHA-256…"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedFile}
                          aria-label="Remove selected file"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-id">Tenant ID</Label>
                  <Input id="tenant-id" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actor-org">Uploaded by</Label>
                  <Input id="actor-org" value={actorOrg} onChange={(e) => setActorOrg(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signer-refs">Signer refs</Label>
                  <Input
                    id="signer-refs"
                    value={signerRefs}
                    onChange={(e) => setSignerRefs(e.target.value)}
                    placeholder="key_acme_primary"
                  />
                </div>
              </div>

              {selectedFile ? (
                <div className="space-y-0 rounded-xl border border-border/80 bg-gradient-to-b from-muted/35 to-background/80">
                  <div className="border-b border-border/60 bg-background/60 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs tracking-[0.16em] text-muted-foreground">Access roles</div>
                        <div className="mt-1 text-base font-medium">Set who can open it</div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {privateAccessEnabled ? "Private" : "Public"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[1fr_1px_0.92fr]">
                    <div className="space-y-4 px-5 py-5">
                      <PolicyRow label="Block external AI tools" value={blockAi} onChange={setBlockAi} />
                      <PolicyRow label="Anyone with link" value={anyoneWithLink} onChange={handleAnyoneWithLinkChange} />

                      <div>
                        <div className="mb-3 text-xs tracking-[0.16em] text-muted-foreground">Embedded AI tags</div>
                        <div className="flex flex-wrap gap-3">
                          {ALL_TAGS.map((tag) => (
                            <label key={tag} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                              <Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                              <span className="text-xs font-medium">{humanizeDocShieldLabel(tag)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="hidden bg-border/70 lg:block" />

                    <div className="space-y-4 px-5 py-5">
                      {privateAccessEnabled ? (
                        <div className="space-y-3">
                          <div className="text-xs tracking-[0.16em] text-muted-foreground">Private access</div>
                          <div className="grid gap-2">
                            <AccessChoice
                              label="Password"
                              description="People enter a password to open the file."
                              active={accessMethod === "password"}
                              onClick={() => setAccessMethod("password")}
                            />
                            <AccessChoice
                              label="Organization sign-in"
                              description="Only signed-in organization users can open it."
                              active={accessMethod === "organization"}
                              onClick={() => setAccessMethod("organization")}
                            />
                          </div>

                          {accessMethod === "password" ? (
                            <div className="space-y-3 pt-1">
                              <div className="space-y-2">
                                <Label>Access password</Label>
                                <Input
                                  type="password"
                                  value={accessPassword}
                                  onChange={(e) => setAccessPassword(e.target.value)}
                                  placeholder="Create a password"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Confirm password</Label>
                                <Input
                                  type="password"
                                  value={accessPasswordConfirm}
                                  onChange={(e) => setAccessPasswordConfirm(e.target.value)}
                                  placeholder="Repeat the password"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                              Organization access uses the signed-in company account. Private link settings stay off.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                          Anyone with the link can open it, and private access settings stay off.
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-muted-foreground">Configure access, then sign the file.</p>
                        <Button onClick={() => void signDocument()} disabled={busy || !selectedFile}>
                          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                          Sign file
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {signedDocument && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signed file ready</CardTitle>
              <CardDescription>{signedDocument.fileName} is ready for the private download page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SignedField label="Document ID" value={signedDocument.documentId} />
                <SignedField label="Fingerprint" value={signedDocument.fingerprint} />
                <SignedField label="Signed at" value={signedDocument.createdAt} />
                <SignedField label="File name" value={signedDocument.fileName} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/app/documents/${encodeURIComponent(signedDocument.documentId)}/download`}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Open download page
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload history</CardTitle>
            <CardDescription>Uploaded documents in this browser session.</CardDescription>
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
                {doc.sourceFileType && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {doc.sourceFileType} {doc.sourceFileSize ? `· ${formatFileSize(doc.sourceFileSize)}` : ""}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {doc.embedded_ai_tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                      {humanizeDocShieldLabel(tag)}
                    </Badge>
                  ))}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
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

function AccessChoice({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
        active ? "border-primary bg-primary/10" : "border-border bg-background/60 hover:border-primary/40"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function SignedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm text-foreground">{value}</div>
    </div>
  );
}

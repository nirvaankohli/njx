import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CircleAlert, Download, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";
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
  accessPasswordRequired?: boolean;
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
  const [blockAi, setBlockAi] = useState(true);
  const [secureLink, setSecureLink] = useState(true);
  const [blockForward, setBlockForward] = useState(true);
  const [blockPublic, setBlockPublic] = useState(true);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPasswordConfirm, setAccessPasswordConfirm] = useState("");
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  function toggleTag(tag: AiTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]));
  }

  async function signDocument() {
    if (!selectedFile || busy) return;
    if (!isSupportedDocumentFile(selectedFile)) {
      toast.error("Unsupported file type", {
        description: "Upload a PDF or DOCX file.",
      });
      return;
    }

    if (passwordRequired && (!accessPassword.trim() || accessPassword !== accessPasswordConfirm)) {
      toast.error("Password mismatch", {
        description: "Enter the same password twice before signing.",
      });
      return;
    }

    setBusy(true);

    try {
      await ensureDevSigningIdentity();
      const tenantId = session.tenantId;
      const issuerKeyId = session.issuerKeyId;
      const actorOrg = session.tenantName || "Employee";
      const fileType = inferDocumentMimeType(selectedFile);
      const fingerprint = await fingerprintDocumentFile(selectedFile);
      const createdAt = toBackendIsoString();
      const documentId = buildDocumentId(selectedFile.name, fingerprint);
      const accessPasswordHash = passwordRequired ? await sha256Hex(accessPassword.trim()) : null;
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

      const response = await api.registerDocument({
        signed_manifest: signedManifest,
        initial_history: [initialEvent],
      });

      const nextDocument: LocalDocument = {
        document_id: manifest.document_id,
        tenant_id: tenantId,
        content_fingerprint: fingerprint,
        policy: manifest.policy,
        embedded_ai_tags: tags,
        signer_refs: [issuerKeyId],
        created_at: createdAt,
        status: "active",
        manifestHash: response.manifest_hash,
        historyTip: response.history_tip,
        signedManifest,
        initialHistory: [initialEvent],
        sourceFileName: selectedFile.name,
        sourceFileType: fileType,
        sourceFileSize: selectedFile.size,
        accessPasswordRequired: passwordRequired,
      };

      setDocs((current) => [nextDocument, ...current.filter((doc) => doc.document_id !== nextDocument.document_id)]);
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
          sourceFileName: selectedFile.name,
          sourceFileType: fileType,
          sourceFileSize: selectedFile.size,
          accessPasswordRequired: passwordRequired,
          accessPasswordHash,
        },
      });
      setSignedDocument({
        documentId: nextDocument.document_id,
        fileName: selectedFile.name,
        fingerprint,
        createdAt,
      });
      setAccessPassword("");
      setAccessPasswordConfirm("");
      toast.success("Document signed", {
        description: `${selectedFile.name} is now ready to download.`,
      });
    } catch (err) {
      toast.error("Document signing failed", {
        description: err instanceof Error ? err.message : "POST /documents not reachable",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSignedDocument(null);
    e.target.value = "";
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Upload</CardTitle>
              <CardDescription>Drop a file or choose one from your device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label
                htmlFor="doc-upload"
                className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <Upload className="h-10 w-10 text-primary" />
                <div className="mt-4 max-w-md space-y-2">
                  <div className="text-lg font-medium">Upload a file to be encrypted or signed</div>
                  <p className="text-sm text-muted-foreground">PDF or DOCX only.</p>
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
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected file</div>
                      <div className="mt-1 truncate text-base font-medium">{selectedFile.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)} · {inferDocumentMimeType(selectedFile)}
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Ready
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access rules</CardTitle>
                <CardDescription>Pick how this file should be shared.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <PolicyRow label="Block external AI tools" value={blockAi} onChange={setBlockAi} />
                  <PolicyRow label="Private URL required" value={secureLink} onChange={setSecureLink} />
                  <PolicyRow label="Block forwarding" value={blockForward} onChange={setBlockForward} />
                  <PolicyRow label="Block public sharing" value={blockPublic} onChange={setBlockPublic} />
                  <PolicyRow label="Password required" value={passwordRequired} onChange={setPasswordRequired} />
                </div>

                {passwordRequired && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Access password</Label>
                      <Input
                        type="password"
                        value={accessPassword}
                        onChange={(e) => setAccessPassword(e.target.value)}
                        placeholder="Create a password for the download page"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Confirm password</Label>
                      <Input
                        type="password"
                        value={accessPasswordConfirm}
                        onChange={(e) => setAccessPasswordConfirm(e.target.value)}
                        placeholder="Repeat the password"
                      />
                    </div>
                  </div>
                )}

                <div>
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

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Configure the access controls, then sign the file.</p>
                  <Button onClick={() => void signDocument()} disabled={busy || !selectedFile}>
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Sign file
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {signedDocument && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signed file ready</CardTitle>
                <CardDescription>{signedDocument.fileName} is ready for the private download page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SignedField label="Document ID" value={signedDocument.documentId} mono />
                  <SignedField label="Fingerprint" value={signedDocument.fingerprint} mono />
                  <SignedField label="Signed at" value={signedDocument.createdAt} mono />
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload history</CardTitle>
              <CardDescription>Recent signed files in this browser session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {docs.slice(0, 4).map((doc) => (
                <div key={doc.document_id} className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{doc.sourceFileName ?? doc.document_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {doc.document_id} · {doc.created_at ? new Date(doc.created_at).toLocaleString() : "Just now"}
                      </div>
                    </div>
                    <Badge variant={doc.status === "revoked" ? "destructive" : "secondary"}>{doc.status ?? "active"}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uploaded documents</CardTitle>
              <CardDescription>Your signed files stay in this session.</CardDescription>
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

function SignedField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

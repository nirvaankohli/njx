import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Bot,
  Building2,
  Copy,
  Download,
  FileText,
  Link2,
  Lock,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  api,
  type AiTag,
  type DocumentManifest,
  type DocumentSummary,
  type SignedHistoryEventPayload,
  type SignedManifestPayload,
} from "@/lib/docshield-api";
import {
  buildDocumentId,
  fingerprintDocumentFile,
  formatFileSize,
  inferDocumentMimeType,
  isSupportedDocumentFile,
} from "@/lib/docshield-file";
import {
  canonicalJsonString,
  getDevSigningIdentity,
  sha256Hex,
  signCanonicalPayload,
  toBackendIsoString,
} from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { humanizeDocShieldLabel } from "@/lib/docshield-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const ALL_TAGS: AiTag[] = ["NO_EXTERNAL_AI"];
type AccessMode = "organization" | "anyone_with_link" | "password";

const ACCESS_MODES: Array<{
  value: AccessMode;
  label: string;
  icon: typeof Building2;
}> = [
  {
    value: "organization",
    label: "People inside Organization",
    icon: Building2,
  },
  {
    value: "anyone_with_link",
    label: "Anyone with Link can access",
    icon: Link2,
  },
  {
    value: "password",
    label: "It needs a password",
    icon: Lock,
  },
];

type LocalDocument = DocumentManifest & {
  manifestHash: string;
  historyTip: string;
  signedManifest: SignedManifestPayload;
  initialHistory: SignedHistoryEventPayload[];
  sourceFileName?: string;
  sourceFileType?: string;
  sourceFileSize?: number;
  accessAnyoneWithLink?: boolean;
  accessMethod?: AccessMode | null;
  accessPasswordHash?: string | null;
};

type SignedDocumentSummary = {
  documentId: string;
  fileName: string;
  fingerprint: string;
  createdAt: string;
};

type ManagedDocument = DocumentSummary & { localOnly?: boolean };
type StatusFilter = "all" | "active" | "revoked";
type TypeFilter = "all" | "pdf" | "docx";
type SortOrder = "newest" | "oldest" | "name";

function describeApiFailure(error: unknown) {
  return error instanceof Error ? error.message : "Backend unavailable";
}

export default function DocumentsPage() {
  const session = getDocShieldSession();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<ManagedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [documentToDelete, setDocumentToDelete] = useState<ManagedDocument | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signedDocument, setSignedDocument] = useState<SignedDocumentSummary | null>(null);
  const [blockAi, setBlockAi] = useState(true);
  const [accessMode, setAccessMode] = useState<AccessMode>("organization");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPasswordConfirm, setAccessPasswordConfirm] = useState("");
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI"]);

  useEffect(() => {
    let cancelled = false;
    setDocumentsLoading(true);
    void api
      .documents(session.tenantId)
      .then((documents) => {
        if (!cancelled) {
          setDocs(documents);
          setDocumentsError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setDocumentsError(describeApiFailure(error));
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.tenantId]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return docs
      .filter((doc) => statusFilter === "all" || doc.status === statusFilter)
      .filter((doc) => {
        if (typeFilter === "all") return true;
        const name = doc.file_name?.toLocaleLowerCase() ?? "";
        const contentType = doc.content_type?.toLocaleLowerCase() ?? "";
        return typeFilter === "pdf"
          ? name.endsWith(".pdf") || contentType === "application/pdf"
          : name.endsWith(".docx") || contentType.includes("wordprocessingml");
      })
      .filter((doc) =>
        normalizedQuery
          ? `${doc.file_name ?? ""} ${doc.document_id} ${doc.content_fingerprint}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          : true,
      )
      .sort((left, right) => {
        if (sortOrder === "name") {
          return (left.file_name ?? left.document_id).localeCompare(right.file_name ?? right.document_id);
        }
        const difference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        return sortOrder === "oldest" ? difference : -difference;
      });
  }, [docs, searchQuery, sortOrder, statusFilter, typeFilter]);

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

    if (accessMode === "password" && (!accessPassword.trim() || accessPassword !== accessPasswordConfirm)) {
      toast.error("Password mismatch", {
        description: "Enter the same password twice before signing.",
      });
      return;
    }

    setBusy(true);

    try {
      const identity = await getDevSigningIdentity();
      const tenantId = session.tenantId;
      const issuerKeyId = identity.keyId;
      const actorOrg = session.tenantName || "Employee";
      const fileType = inferDocumentMimeType(selectedFile);
      const fingerprint = await fingerprintDocumentFile(selectedFile);
      const createdAt = toBackendIsoString();
      const documentId = buildDocumentId(fingerprint);
      const accessPasswordHash = accessMode === "password" ? await sha256Hex(accessPassword.trim()) : null;
      const accessAnyoneWithLink = accessMode === "anyone_with_link";
      const accessMethod = accessMode === "organization" ? "organization" : accessMode === "password" ? "password" : null;
      const manifest = {
        schema_version: "1.0",
        tenant_id: tenantId,
        document_id: documentId,
        issuer_key_id: issuerKeyId,
        content_fingerprint: fingerprint,
        policy: {
          external_ai_upload: blockAi ? "blocked" : "allowed",
          secure_link_required: true,
          forwarding: "blocked",
          public_sharing: accessAnyoneWithLink ? "allowed" : "blocked",
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
        event_id: `evt_issued_${crypto.randomUUID()}`,
        document_id: manifest.document_id,
        event: "issued" as const,
        actor_org: actorOrg,
        actor_key_id: issuerKeyId,
        timestamp: createdAt,
        previous_event_hash: null,
        manifest_hash: manifestHash,
        payload: { file_name: selectedFile.name },
      };
      const initialEvent: SignedHistoryEventPayload = {
        ...initialEventBase,
        signature: await signCanonicalPayload(initialEventBase),
      };

      const localHistoryTip = await sha256Hex(canonicalJsonString(initialEvent));
      let manifestHashToStore = manifestHash;
      let historyTipToStore = localHistoryTip;
      let backendSynced = false;
      let backendErrorMessage: string | null = null;
      let shareLink = null;

      try {
        await api.setup({
          tenant: {
            tenant_id: tenantId,
            org_name: session.tenantName,
            domains: session.domains,
            admin_emails: session.adminEmails,
          },
          policy_templates: [],
          public_keys: [{ key_id: issuerKeyId, public_key_b64: identity.publicKeyB64 }],
        });
        const response = await api.registerDocument({
          signed_manifest: signedManifest,
          initial_history: [initialEvent],
        });
        await api.uploadDocumentContent(documentId, selectedFile);
        shareLink = await api.createShareLink(documentId, {
          access_method: accessAnyoneWithLink ? "link" : accessMethod ?? "organization",
          password_hash: accessPasswordHash,
          expires_in_hours: 168,
        });
        manifestHashToStore = response.manifest_hash;
        historyTipToStore = response.history_tip;
        backendSynced = true;
      } catch (error) {
        backendSynced = false;
        backendErrorMessage = describeApiFailure(error);
      }

      const nextDocument: LocalDocument = {
        document_id: manifest.document_id,
        tenant_id: tenantId,
        content_fingerprint: fingerprint,
        policy: manifest.policy,
        embedded_ai_tags: tags,
        signer_refs: [issuerKeyId],
        created_at: createdAt,
        status: "active",
        manifestHash: manifestHashToStore,
        historyTip: historyTipToStore,
        signedManifest,
        initialHistory: [initialEvent],
        sourceFileName: selectedFile.name,
        sourceFileType: fileType,
        sourceFileSize: selectedFile.size,
        accessAnyoneWithLink,
        accessMethod,
        accessPasswordHash,
      };

      const managedDocument: ManagedDocument = {
        document_id: nextDocument.document_id,
        tenant_id: nextDocument.tenant_id,
        issuer_key_id: issuerKeyId,
        content_fingerprint: nextDocument.content_fingerprint,
        policy: nextDocument.policy,
        embedded_ai_tags: nextDocument.embedded_ai_tags,
        created_at: createdAt,
        status: "active",
        file_name: selectedFile.name,
        content_type: fileType,
        size_bytes: selectedFile.size,
        access_method: accessAnyoneWithLink ? "link" : accessMethod,
        event_count: 1,
        localOnly: !backendSynced,
      };
      setDocs((current) => [managedDocument, ...current.filter((doc) => doc.document_id !== managedDocument.document_id)]);
      updateDocShieldSession({
        tenantId,
        tenantName: session.tenantName,
        issuerKeyId,
        activeDocument: {
          documentId: nextDocument.document_id,
          contentFingerprint: fingerprint,
          manifestHash: manifestHashToStore,
          historyTip: historyTipToStore,
          signedManifest,
          history: [initialEvent],
          sourceFileName: selectedFile.name,
          sourceFileType: fileType,
          sourceFileSize: selectedFile.size,
          accessAnyoneWithLink,
          accessMethod,
          accessPasswordHash,
          shareLink: shareLink
            ? {
                linkId: shareLink.link_id,
                token: shareLink.token,
                expiresAt: shareLink.expires_at,
              }
            : null,
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
      setAccessMode("organization");
      if (backendSynced) {
        toast.success("Secure document ready", {
          description: `${selectedFile.name} now has an encrypted passport and secure link.`,
        });
      } else {
        toast.message("Saved locally", {
          description: `${selectedFile.name} was signed in your browser session.${backendErrorMessage ? ` ${backendErrorMessage}` : ""}`,
        });
      }
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

  function handleUploadKeyDown(event: React.KeyboardEvent<HTMLLabelElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      uploadInputRef.current?.click();
    }
  }

  async function deleteSelectedDocument() {
    if (!documentToDelete || deletingDocumentId) return;
    setDeletingDocumentId(documentToDelete.document_id);
    try {
      if (!documentToDelete.localOnly) {
        await api.deleteDocument(documentToDelete.document_id, session.tenantId);
      }
      setDocs((current) => current.filter((doc) => doc.document_id !== documentToDelete.document_id));
      if (session.activeDocument?.documentId === documentToDelete.document_id) {
        updateDocShieldSession({ activeDocument: null });
      }
      toast.success("Document deleted", {
        description: `${documentToDelete.file_name ?? documentToDelete.document_id} and its managed data were removed.`,
      });
      setDocumentToDelete(null);
    } catch (error) {
      toast.error("Could not delete document", { description: describeApiFailure(error) });
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function copyDownloadLink() {
    if (!signedDocument) return;
    const downloadUrl = `${window.location.origin}/app/documents/${encodeURIComponent(signedDocument.documentId)}/download`;
    await navigator.clipboard.writeText(downloadUrl);
    toast.success("Download link copied", {
      description: "Paste it anywhere to open the signed download page.",
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a file to be encrypted or signed.</h1>
        <p className="text-sm text-muted-foreground">
          Choose a PDF or DOCX, then set the access controls before signing.
        </p>
      </header>

      <div className="space-y-6">
        <Card className="w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Upload</CardTitle>
            <CardDescription>Drop a file or choose one from your device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label
              htmlFor="doc-upload"
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              onKeyDown={handleUploadKeyDown}
              className="flex min-h-44 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Upload className="h-10 w-10 text-primary" />
              <div className="mt-4 max-w-md space-y-2">
                <div className="text-lg font-medium">Upload a file to be encrypted or signed</div>
                <p className="text-sm text-muted-foreground">PDF or DOCX only.</p>
              </div>
            </label>
            <Input
              ref={uploadInputRef}
              id="doc-upload"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
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

            {selectedFile && (
              <Card className="border-border/80 bg-background/70">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-base">Access rules</CardTitle>
                  <CardDescription>Choose who can open the signed package.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="text-md font-medium">Block external AI tools</div>
                    </div>
                    <Switch checked={blockAi} onCheckedChange={setBlockAi} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label className="text-md font-medium">Who can Access It?</Label>
                    <Select value={accessMode} onValueChange={(value) => setAccessMode(value as AccessMode)}>
                      <SelectTrigger className="w-full sm:w-[300px]">
                        <SelectValue placeholder="People inside Organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESS_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            <div className="flex items-center gap-2">
                              <mode.icon className="h-4 w-4 text-muted-foreground" />
                              <span>{mode.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {accessMode === "password" && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        Password
                      </Label>
                      <Input
                        type="password"
                        value={accessPassword}
                        onChange={(e) => setAccessPassword(e.target.value)}
                        placeholder="Create a password for the download page"
                      />
                      <Input
                        type="password"
                        value={accessPasswordConfirm}
                        onChange={(e) => setAccessPasswordConfirm(e.target.value)}
                        placeholder="Repeat the password"
                      />
                    </div>
                  )}

                  <div>
                    <div className="mb-3 text-sm font-medium">Embedded AI tags</div>
                    <div className="flex flex-wrap gap-3">
                      {ALL_TAGS.map((tag) => (
                        <label key={tag} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                          <Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                          <span className="font-mono text-xs">{humanizeDocShieldLabel(tag)}</span>
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
          </CardContent>
        </Card>

        {signedDocument && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signed file ready</CardTitle>
              <CardDescription>{signedDocument.documentId} is ready for the private download page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SignedField label="Download ID" value={signedDocument.documentId} mono />
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
                <Button variant="outline" onClick={() => void copyDownloadLink()}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy download link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document library</CardTitle>
            <CardDescription>Find, inspect, and manage every signed document in your organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px]">
              <div className="relative">
                <Label htmlFor="document-search" className="sr-only">Search documents</Label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="document-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, ID, or fingerprint"
                  className="pl-9"
                />
              </div>
              <FilterSelect label="Status" value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </FilterSelect>
              <FilterSelect label="File type" value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
                <SelectItem value="all">All file types</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
              </FilterSelect>
              <FilterSelect label="Sort documents" value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </FilterSelect>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span>{filteredDocuments.length} {filteredDocuments.length === 1 ? "document" : "documents"}</span>
              {(searchQuery || statusFilter !== "all" || typeFilter !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {documentsError && (
              <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                The document service could not be reached. You can still manage documents signed in this session. {documentsError}
              </div>
            )}

            {documentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">{docs.length ? "No documents match these filters" : "No documents yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {docs.length ? "Clear or adjust the filters to see more." : "Upload and sign your first PDF or DOCX above."}
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Documents">
                {filteredDocuments.map((doc) => (
                  <li key={doc.document_id} className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2 transition-colors hover:border-primary/40 hover:bg-secondary/20">
                    <Link
                      to={`/app/documents/${encodeURIComponent(doc.document_id)}`}
                      className="min-w-0 flex-1 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open ${doc.file_name ?? doc.document_id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="truncate font-medium">{doc.file_name ?? doc.document_id}</div>
                            {doc.localOnly && <Badge variant="outline">Local only</Badge>}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{doc.document_id}</div>
                        </div>
                        <Badge variant={doc.status === "revoked" ? "destructive" : "secondary"}>{doc.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDocumentDate(doc.created_at)}</span>
                        {doc.content_type && <span>{friendlyFileType(doc.content_type)}</span>}
                        {doc.size_bytes != null && <span>{formatFileSize(doc.size_bytes)}</span>}
                        <span>{doc.event_count} {doc.event_count === 1 ? "event" : "events"}</span>
                        {doc.access_method && <span>Access: {doc.access_method === "link" ? "secure link" : doc.access_method}</span>}
                      </div>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${doc.file_name ?? doc.document_id}`}
                      onClick={() => setDocumentToDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(documentToDelete)} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete?.file_name ?? documentToDelete?.document_id} and its content, secure links, history, and analytics will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingDocumentId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedDocument();
              }}
              disabled={Boolean(deletingDocumentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDocumentId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="sr-only">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function friendlyFileType(contentType: string) {
  if (contentType === "application/pdf") return "PDF";
  if (contentType.includes("wordprocessingml")) return "DOCX";
  return contentType;
}

function formatDocumentDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function SignedField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

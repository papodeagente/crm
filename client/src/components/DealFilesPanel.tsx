import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileText, Upload, Trash2, Download, Loader2, File, Image, Music, Video,
  FileSpreadsheet, FileCode, Archive, Plus, FolderOpen, Eye, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gzip")) return Archive;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("html")) return FileCode;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) return FileText;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toUpperCase() || "" : "";
}

interface DealFilesPanelProps {
  dealId: number;
  onRefresh?: () => void;
}

export default function DealFilesPanel({ dealId, onRefresh }: DealFilesPanelProps) {
  const filesQ = trpc.crm.deals.files.list.useQuery({ dealId }, { enabled: dealId > 0 });
  const uploadMut = trpc.crm.deals.files.upload.useMutation();
  const deleteMut = trpc.crm.deals.files.delete.useMutation();

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = filesQ.data || [];

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: arquivo muito grande (máx. 15MB)`);
        errorCount++;
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await uploadMut.mutateAsync({
          dealId,
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        successCount++;
      } catch (err: any) {
        toast.error(`Erro ao enviar ${file.name}: ${err.message}`);
        errorCount++;
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} arquivo${successCount > 1 ? "s" : ""} enviado${successCount > 1 ? "s" : ""}`);
      filesQ.refetch();
      onRefresh?.();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [dealId, uploadMut, filesQ, onRefresh]);

  const handleDelete = useCallback(async (fileId: number) => {
    try {
      await deleteMut.mutateAsync({ id: fileId, dealId });
      toast.success("Arquivo removido");
      filesQ.refetch();
      onRefresh?.();
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(`Erro ao remover: ${err.message}`);
    }
  }, [dealId, deleteMut, filesQ, onRefresh]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const isImage = (mimeType: string | null) => mimeType?.startsWith("image/");
  const isPdf = (mimeType: string | null) => mimeType?.includes("pdf");

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Arquivos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {files.length} arquivo{files.length !== 1 ? "s" : ""} anexado{files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="self-start sm:self-auto"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5 mr-1" />
          )}
          Enviar Arquivo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg transition-all ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-muted-foreground/30"
        } ${files.length === 0 ? "py-12" : "py-4"}`}
      >
        {files.length === 0 && !uploading ? (
          <div className="text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum arquivo anexado</p>
            <p className="text-xs mt-1">Arraste arquivos aqui ou clique em "Enviar Arquivo"</p>
          </div>
        ) : (
          <div className="space-y-1.5 px-3">
            {uploading && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-primary font-medium">Enviando arquivo(s)...</span>
              </div>
            )}
            {files.map((f: any) => {
              const Icon = getFileIcon(f.mimeType);
              const ext = getExtension(f.fileName);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  {/* File icon */}
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 relative">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {ext && (
                      <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-bold bg-primary/10 text-primary px-1 rounded">
                        {ext}
                      </span>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatFileSize(f.sizeBytes)}</span>
                      <span>·</span>
                      <span>{formatDate(f.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(isImage(f.mimeType) || isPdf(f.mimeType)) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setPreviewFile(f)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Visualizar</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => window.open(f.url, "_blank")}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(f.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remover</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}

            {/* Drop hint when files exist */}
            {!uploading && (
              <div className="text-center py-2">
                <p className="text-[11px] text-muted-foreground/60">
                  Arraste mais arquivos aqui para enviar
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover arquivo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O arquivo será removido desta negociação. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewFile !== null} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewFile?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[65vh]">
            {previewFile && isImage(previewFile.mimeType) && (
              <img
                src={previewFile.url}
                alt={previewFile.fileName}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
            {previewFile && isPdf(previewFile.mimeType) && (
              <iframe
                src={previewFile.url}
                className="w-full h-[60vh] rounded-lg border"
                title={previewFile.fileName}
              />
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => window.open(previewFile?.url, "_blank")}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

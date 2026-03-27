import { useState } from "react";
import { toast } from "sonner";

export function useExportDownload() {
  const [isExporting, setIsExporting] = useState(false);

  function downloadBase64(base64: string, filename: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExport(
    mutateAsync: () => Promise<{ base64: string; filename: string; count: number }>,
    entityLabel: string
  ) {
    setIsExporting(true);
    try {
      const result = await mutateAsync();
      downloadBase64(result.base64, result.filename);
      toast.success(`${result.count} ${entityLabel} exportados com sucesso`);
    } catch (err: any) {
      toast.error(`Erro ao exportar ${entityLabel}: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, handleExport };
}

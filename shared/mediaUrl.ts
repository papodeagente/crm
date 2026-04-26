/**
 * Retorna true apenas se a URL aponta para midia ja rehospedada em nosso S3.
 * Qualquer outro host (whatsapp.net, backblazeb2 temp-file-download, CDNs de
 * provider, etc.) eh temporario — a midia precisa ser re-baixada via
 * mediaDownloadWorker (server) ou MediaLoader/getMediaUrl (client).
 *
 * Heuristica anterior ("nao contem whatsapp.net") falhava pois o Z-API passou
 * a entregar URLs de Backblaze B2 "temp-file-download" tambem temporarias,
 * deixando audio/imagem com URL caducada que quebrava no player.
 */
export function isRehostedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Nosso storage vive em AWS S3 (sa-east-1). URLs aceitas:
  //   - virtual-hosted: <bucket>.s3.<region>.amazonaws.com/...
  //   - path-style:     s3.<region>.amazonaws.com/<bucket>/...
  return /\.amazonaws\.com\//.test(url);
}

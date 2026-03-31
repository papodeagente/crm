/**
 * useMediaHandling — File validation, base64 conversion, paste handler, preview
 *
 * Z-API limits:
 *  - Image: <16MB (send-image)
 *  - Video: <64MB (send-video, async:true for large)
 *  - Audio: <16MB (send-audio)
 *  - Document: <100MB (send-document/{ext})
 *  - Media files expire in 30 days on Z-API
 */

import { useState, useCallback, useEffect, useRef } from "react";

// ─── Size Limits (bytes) ───
const LIMITS: Record<MediaType, number> = {
  image: 16 * 1024 * 1024,     // 16MB
  video: 64 * 1024 * 1024,     // 64MB
  audio: 16 * 1024 * 1024,     // 16MB
  document: 100 * 1024 * 1024, // 100MB
};

const LIMIT_LABELS: Record<MediaType, string> = {
  image: "16MB",
  video: "64MB",
  audio: "16MB",
  document: "100MB",
};

// ─── Accepted MIME types ───
const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml",
]);

const VIDEO_TYPES = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
]);

const AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/mp4",
  "audio/ogg; codecs=opus", "audio/webm;codecs=opus",
]);

export type MediaType = "image" | "video" | "audio" | "document";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SelectedMedia {
  file: File;
  preview: string | null;
  mediaType: MediaType;
}

/**
 * Detect media type from file MIME type
 */
export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Validate file against Z-API limits
 */
export function validateFile(file: File, type?: MediaType): ValidationResult {
  const mediaType = type ?? detectMediaType(file);
  const limit = LIMITS[mediaType];

  if (file.size > limit) {
    return {
      valid: false,
      error: `Arquivo muito grande (${formatSize(file.size)}). Limite para ${mediaType}: ${LIMIT_LABELS[mediaType]}`,
    };
  }

  // For image/video/audio, validate MIME type
  if (mediaType === "image" && !IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: `Tipo de imagem não suportado: ${file.type}` };
  }
  if (mediaType === "video" && !VIDEO_TYPES.has(file.type)) {
    return { valid: false, error: `Tipo de vídeo não suportado: ${file.type}` };
  }
  // Audio and document accept most types

  return { valid: true };
}

/**
 * Extract file extension for Z-API /send-document/{ext}
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

/**
 * Convert File to base64 (without data:... prefix)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Blob to base64 (without data:... prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Hook for managing file selection, validation, preview, and clipboard paste
 */
export function useMediaHandling() {
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const selectFile = useCallback((file: File): ValidationResult => {
    const mediaType = detectMediaType(file);
    const validation = validateFile(file, mediaType);
    if (!validation.valid) {
      return validation;
    }

    // Revoke previous preview
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // Create preview for images/videos
    let preview: string | null = null;
    if (mediaType === "image" || mediaType === "video") {
      preview = URL.createObjectURL(file);
      previewUrlRef.current = preview;
    }

    setSelectedMedia({ file, preview, mediaType });
    return { valid: true };
  }, []);

  const clearFile = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedMedia(null);
  }, []);

  /**
   * Handle paste event — extracts image from clipboard
   * Returns the File if an image was pasted, null otherwise
   */
  const handlePaste = useCallback((e: ClipboardEvent): File | null => {
    const items = e.clipboardData?.items;
    if (!items) return null;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const renamed = new File([file], `clipboard-${Date.now()}.png`, { type: file.type });
          selectFile(renamed);
          return renamed;
        }
      }
    }
    return null;
  }, [selectFile]);

  return {
    selectedMedia,
    selectFile,
    clearFile,
    handlePaste,
  };
}

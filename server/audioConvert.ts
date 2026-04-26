/**
 * Audio format conversion utility.
 *
 * Converts audio buffers to OGG/Opus (WhatsApp native PTT format)
 * using ffmpeg via stdin/stdout pipes — no temp files needed.
 */

import { spawn } from "child_process";

/**
 * Convert an audio buffer to OGG/Opus format using ffmpeg.
 * Returns the original buffer unchanged if already OGG.
 *
 * @param input  Raw audio bytes (WebM, MP4, etc.)
 * @param mime   Source MIME type (e.g. "audio/webm;codecs=opus")
 * @returns      OGG/Opus buffer ready for WhatsApp
 */
export async function convertToOggOpus(input: Buffer, mime: string): Promise<Buffer> {
  const baseMime = mime.split(";")[0].trim().toLowerCase();

  // Already OGG — no conversion needed
  if (baseMime === "audio/ogg") return input;

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",        // read from stdin
      "-c:a", "libopus",     // Opus codec
      "-b:a", "48k",         // 48kbps — good quality for voice, small file
      "-ar", "48000",        // 48kHz sample rate (Opus standard)
      "-ac", "1",            // mono (voice)
      "-f", "ogg",           // OGG container
      "-y",                  // overwrite
      "pipe:1",              // write to stdout
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    ffmpeg.on("close", (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        console.error(`[audioConvert] ffmpeg exited with code ${code}:`, stderr.slice(-500));
        // Return original buffer as fallback — better to send WebM than nothing
        resolve(input);
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("[audioConvert] ffmpeg spawn error:", err.message);
      // ffmpeg not available — return original buffer
      resolve(input);
    });

    ffmpeg.stdin.write(input);
    ffmpeg.stdin.end();
  });
}

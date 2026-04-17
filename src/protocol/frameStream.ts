/** @format */

const ASCII_SAFE = /[^\x20-\x7E\r\n]/g;

export class FrameStream {
  private buffer = "";

  private flushFrame(frames: string[]): void {
    const frame = this.buffer.trim();
    this.buffer = "";

    if (frame.length > 0) {
      frames.push(frame);
    }
  }

  pushChunk(chunk: string): string[] {
    const frames: string[] = [];
    const safeChunk = chunk.replace(ASCII_SAFE, "");

    for (const char of safeChunk) {
      if (char === ";") {
        this.flushFrame(frames);
        continue;
      }

      if (char === "\n" || char === "\r") {
        if (this.buffer.length > 0) {
          this.flushFrame(frames);
        }

        continue;
      }

      if (this.buffer.length < 120) {
        this.buffer += char;
      } else {
        // Drop malformed oversized frame and resync on next delimiter.
        this.buffer = "";
      }
    }

    return frames;
  }

  reset(): void {
    this.buffer = "";
  }
}

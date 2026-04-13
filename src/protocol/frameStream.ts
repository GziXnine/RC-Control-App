const ASCII_SAFE = /[^\x20-\x7E]/g;

export class FrameStream {
  private buffer = "";

  pushChunk(chunk: string): string[] {
    const frames: string[] = [];
    const safeChunk = chunk.replace(ASCII_SAFE, "");

    for (const char of safeChunk) {
      if (char === ";") {
        const frame = this.buffer.trim();
        this.buffer = "";

        if (frame.length > 0) {
          frames.push(frame);
        }

        continue;
      }

      if (char === "\n" || char === "\r") {
        continue;
      }

      if (this.buffer.length < 120) {
        this.buffer += char;
      } else {
        // Drop malformed oversized frame and resync on next ';'.
        this.buffer = "";
      }
    }

    return frames;
  }

  reset(): void {
    this.buffer = "";
  }
}

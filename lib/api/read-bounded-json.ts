export class RequestBodyTooLargeError extends Error {}

export async function readBoundedJson(req: Request, maxBytes: number): Promise<unknown> {
  const contentLength = Number.parseInt(req.headers.get("content-length") ?? "", 10);
  if (contentLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError("Missing JSON body");

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        // A slow or failing cancellation must not delay the response.
        void reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

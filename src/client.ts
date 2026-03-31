 import type { Part, SendMessageSuccessResponse, Task } from "@a2a-js/sdk";
 import { A2AClient } from "@a2a-js/sdk/client";
 import { v0_8 } from "@a2ui/lit";
 
 const A2UI_MIME_TYPE = "application/json+a2ui";
 
 export class A2UIClient {
  #serverUrl: string = "http://localhost:8080/";
  #client: A2AClient | null = null;
 
  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.#serverUrl = serverUrl;
    }
  }
 
   #ready: Promise<void> = Promise.resolve();
   get ready() {
     return this.#ready;
   }
 
   async #getClient() {
     console.log("this.#client", this.#client);
     if (!this.#client) {
       // Default to localhost:xxxx if no URL provided (fallback for restaurant app default)
       console.log("this.#serverUrl", this.#serverUrl);
      //  const baseUrl = this.#serverUrl || "http://localhost:8080";
       const baseUrl = this.#serverUrl || "http://127.0.0.1:8000";
 
       this.#client = await A2AClient.fromCardUrl(
         `${baseUrl}/.well-known/agent-card.json`,
         {
           fetchImpl: async (url, init) => {
             console.log("The library sent me this init object:", init);
             const headers = new Headers(init?.headers);
             headers.set("X-A2A-Extensions", "https://a2ui.org/a2a-extension/a2ui/v0.8");
             return fetch(url, { ...init, headers });
           }
         }
       );
     }
     return this.#client;
   }
 
   async send(
     message: v0_8.Types.A2UIClientEventMessage | string
   ): Promise<v0_8.Types.ServerToClientMessage[]> {
     const client = await this.#getClient();
 
     let parts: Part[] = [];
 
     if (typeof message === 'string') {
       // Try to parse as JSON first, just in case
       try {
         const parsed = JSON.parse(message);
         if (typeof parsed === 'object' && parsed !== null) {
           parts = [{
             kind: "data",
             data: parsed as unknown as Record<string, unknown>,
             mimeType: A2UI_MIME_TYPE,
           } as Part];
         } else {
           parts = [{ kind: "text", text: message }];
         }
       } catch {
         parts = [{ kind: "text", text: message }];
       }
     } else {
       parts = [{
         kind: "data",
         data: message as unknown as Record<string, unknown>,
         mimeType: A2UI_MIME_TYPE,
       } as Part];
     }
 
     const response = await client.sendMessage({
       message: {
         messageId: crypto.randomUUID(),
         role: "user",
         parts: parts,
         kind: "message",
       },
     });
 
     if ("error" in response) {
       throw new Error(response.error.message);
     }
 
     const result = (response as SendMessageSuccessResponse).result as Task;
     if (result.kind === "task" && result.status.message?.parts) {
       const messages: v0_8.Types.ServerToClientMessage[] = [];
       for (const part of result.status.message.parts) {
         if (part.kind === 'data') {
           messages.push(part.data as v0_8.Types.ServerToClientMessage);
         }
       }
       return messages;
     }
 
     return [];
   }
 }
 
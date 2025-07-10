// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type { ClientMessage, Message } from "ai";
import { parseStreamPart } from "ai";
import { createParser } from "eventsource-parser";

/**
 * Creates an agent client that connects to the Personal Assistant
 * Supports both WebSocket and HTTP connections
 * @param id - Optional ID for the agent instance
 * @returns Agent client with send and connect methods
 */
export function createAgentClient(id = "main-assistant") {
  const baseUrl = window.location.origin;
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return {
    // Send messages via HTTP POST
    async send(messages: ClientMessage[]) {
      const response = await fetch(`${baseUrl}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    },

    // Connect via WebSocket for real-time communication
    connect() {
      const ws = new WebSocket(
        `${wsProtocol}//${window.location.host}/agents/personal-assistant/${id}`
      );

      return {
        send: (data: string) => ws.send(data),
        onMessage: (handler: (event: MessageEvent) => void) => {
          ws.onmessage = handler;
        },
        onError: (handler: (event: Event) => void) => {
          ws.onerror = handler;
        },
        onClose: (handler: (event: CloseEvent) => void) => {
          ws.onclose = handler;
        },
        close: () => ws.close(),
      };
    },
  };
}

/**
 * Parses streaming data responses from the AI
 * Handles both text content and structured data
 * @param data - Raw streaming data
 * @returns Parsed content as Message array or null
 */
export function parseStreamingDataResponse(data: string): Message[] | null {
  const trimmedData = data.trim();
  if (!trimmedData || trimmedData === "{}") return null;

  if (trimmedData.startsWith("0:")) {
    try {
      return JSON.parse(trimmedData.slice(2)) as Message[];
    } catch (e) {
      console.error("Failed to parse messages:", e);
      return null;
    }
  }

  if (trimmedData.startsWith("8:") || trimmedData.startsWith("e:")) {
    const content = trimmedData.slice(2);
    try {
      const json = JSON.parse(content);
      return [json];
    } catch (e) {
      console.error("Failed to parse JSON content:", e);
      return null;
    }
  }

  try {
    const parser = createParser((event) => {
      if (event.type === "data" && event.data) {
        const parsed = parseStreamPart(event.data);
        if (parsed.type === "text") {
          return [
            {
              role: "assistant",
              content: parsed.value,
            },
          ];
        }
      }
    });

    parser.feed(trimmedData);
  } catch (e) {
    console.error("Failed to parse streaming data:", e);
  }

  return null;
}

/**
 * Formats a message timestamp for display
 * @param date - Date to format
 * @returns Formatted time string
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Debounces a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Process tool calls and handle confirmations
 * @param messages - Array of messages
 * @param dataStream - Data stream for responses
 * @param tools - Available tools
 * @param executions - Tool execution functions
 * @returns Processed messages
 */
export async function processToolCalls({
  messages,
  dataStream,
  tools,
  executions,
}: {
  messages: Message[];
  dataStream: any;
  tools: Record<string, any>;
  executions: Record<string, any>;
}): Promise<Message[]> {
  const lastMessage = messages[messages.length - 1];
  
  if (
    lastMessage.role === "assistant" &&
    lastMessage.toolInvocations &&
    lastMessage.toolInvocations.length > 0
  ) {
    for (const toolInvocation of lastMessage.toolInvocations) {
      if ("result" in toolInvocation) continue;

      const { toolCallId, toolName, args } = toolInvocation;

      if (tools[toolName]?.execute) {
        // Auto-execute tools that have an execute function
        const result = await tools[toolName].execute(args);
        dataStream.writeData({
          type: "tool-result",
          toolCallId,
          result,
        });
      } else if (executions[toolName]) {
        // Execute confirmed tools
        const result = await executions[toolName](args);
        dataStream.writeData({
          type: "tool-result", 
          toolCallId,
          result,
        });
      }
    }
  }

  return messages;
}

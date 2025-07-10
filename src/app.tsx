import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { Message } from "@ai-sdk/react";
import type { tools } from "./tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";
import useTheme from "./hooks/useTheme";

// Icon imports
import {
  Moon,
  Sun,
  Bug,
  Trash,
  PaperPlaneLine,
  Robot,
} from "@phosphor-icons/react";

// List of tools that require human confirmation
// NOTE: this should match the keys in the executions object in tools.ts
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

// State interface for chat messages
interface ChatState {
  messages: Message[];
  loading: boolean;
  openAIKeySet: boolean;
}

// Custom hook for persisting messages in session storage
function usePersistedMessages(key: string) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Check localStorage first, default to dark if not found
    const savedMessages = localStorage.getItem(key);
    return savedMessages ? JSON.parse(savedMessages) : [];
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(messages));
  }, [messages, key]);

  return messages;
}

// Main App component - Personal Assistant Interface
export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  
  useTheme(theme);
  
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = usePersistedMessages("personal-assistant-messages");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConfirmation, setCurrentConfirmation] = useState<{
    toolName: string;
    toolCallId: string;
    args: any;
  } | null>(null);

  const toolsRequiringConfirmation = ["getWeather", "searchWeb", "draftEmail"];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const agent = useAgent({
    agent: "personal-assistant",
    name: "main-assistant",
  });

  const {
    messages: agentMessages,
    input: agentInput,
    setInput: setAgentInput,
    append,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
    isLoading: isLoadingAgent,
    stop,
  } = useAgentChat({
    agent,
    onError: (error: Error) => {
      console.error("Agent chat error:", error);
    },
  });

  // Update messages when agent messages change
  useEffect(() => {
    if (agentMessages.length > 0) {
      setMessages(agentMessages);
    }
  }, [agentMessages, setMessages]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    
    setInput("");
    await append({
      role: "user",
      content: message,
    });
  }, [append, setInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const clearAllMessages = () => {
    clearHistory();
    setMessages([]);
    localStorage.removeItem("personal-assistant-messages");
  };

  const pendingToolCallConfirmation = agentMessages.some((m: Message) =>
    m.parts?.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        toolsRequiringConfirmation.includes(
          part.toolInvocation.toolName as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">PA</span>
            </div>
            <h1 className="text-xl font-semibold">Personal Assistant</h1>
            <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 rounded-md">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="rounded-full h-9 w-9"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="rounded-full h-9 w-9"
              onClick={clearAllMessages}
            >
              <Trash size={20} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          {/* Welcome message if no messages */}
          {messages.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                Welcome to Your Personal Assistant
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                I'm here to help you manage tasks, schedule reminders, take notes, and more. 
                Just ask me anything!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <button
                  onClick={() => handleSendMessage("What can you help me with?")}
                  className="text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <h3 className="font-medium mb-1">💡 Capabilities</h3>
                  <p className="text-sm text-muted-foreground">
                    Learn what I can do for you
                  </p>
                </button>
                <button
                  onClick={() => handleSendMessage("Create a task for tomorrow")}
                  className="text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <h3 className="font-medium mb-1">✅ Create Task</h3>
                  <p className="text-sm text-muted-foreground">
                    Start managing your to-dos
                  </p>
                </button>
                <button
                  onClick={() => handleSendMessage("Schedule a reminder in 30 minutes")}
                  className="text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <h3 className="font-medium mb-1">⏰ Set Reminder</h3>
                  <p className="text-sm text-muted-foreground">
                    Never forget important things
                  </p>
                </button>
                <button
                  onClick={() => handleSendMessage("Take a note about my meeting")}
                  className="text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <h3 className="font-medium mb-1">📝 Take Note</h3>
                  <p className="text-sm text-muted-foreground">
                    Capture your thoughts quickly
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : ""
              }`}
            >
              {message.role === "assistant" && (
                <Avatar username="PA" className="h-8 w-8 shrink-0" />
              )}
              <div
                className={`flex flex-col gap-1 ${
                  message.role === "user" ? "items-end" : "items-start flex-1"
                }`}
              >
                <Card
                  className={`px-4 py-3 max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  }`}
                >
                  {message.content && (
                    <MemoizedMarkdown
                      content={message.content}
                      className={
                        message.role === "user" ? "prose-invert" : ""
                      }
                    />
                  )}
                  {message.toolInvocations && (
                    <div className="mt-3 space-y-2">
                      {message.toolInvocations.map((tool) => (
                        <ToolInvocationCard
                          key={tool.toolCallId}
                          tool={tool}
                          result={tool.result}
                          isLoading={isLoading && !tool.result}
                        />
                      ))}
                    </div>
                  )}
                </Card>
                {message.role === "assistant" && (
                  <span className="text-xs text-muted-foreground px-1">
                    {new Date(message.createdAt || Date.now()).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                )}
              </div>
              {message.role === "user" && (
                <Avatar username="You" className="h-8 w-8 shrink-0" />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e, {
              data: {
                annotations: {
                  hello: "world",
                },
              },
            });
            setTextareaHeight("auto"); // Reset height after submission
          }}
          className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={
                  pendingToolCallConfirmation
                    ? "Please respond to the tool confirmation above..."
                    : "Send a message..."
                }
                className="flex w-full border border-neutral-200 dark:border-neutral-700 px-3 py-2  ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 dark:bg-neutral-900"
                value={agentInput}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  // Auto-resize the textarea
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto"); // Reset height on Enter submission
                  }
                }}
                rows={2}
                style={{ height: textareaHeight }}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    aria-label="Stop generation"
                  >
                    <Stop size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    disabled={pendingToolCallConfirmation || !agentInput.trim()}
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  {/** biome-ignore lint/nursery/useUniqueElementIds: it's fine */}
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

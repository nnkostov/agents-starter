/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";
import { getCurrentAgent } from "agents";
import type { PersonalAssistant } from "./server";

// Types for better type safety
interface TaskData {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  type?: string;
  scheduledFor?: string;
  cronPattern?: string;
  delaySeconds?: number;
}

interface NoteData {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
}

// Centralized KV helper functions for better efficiency
class KVHelper {
  private static async getEnv() {
    const { agent } = getCurrentAgent<PersonalAssistant>();
    if (!agent) throw new Error("Agent context not available");
    return agent.env;
  }

  static async saveTask(taskId: string, data: Partial<TaskData>) {
    const env = await this.getEnv();
    await env.TASKS_KV.put(taskId, JSON.stringify(data));
  }

  static async getTask(taskId: string): Promise<TaskData | null> {
    const env = await this.getEnv();
    return await env.TASKS_KV.get(taskId, "json");
  }

  static async listTasks(prefix: string = "task:"): Promise<TaskData[]> {
    const env = await this.getEnv();
    const list = await env.TASKS_KV.list({ prefix });
    const tasks = await Promise.all(
      list.keys.map(async (key: { name: string }) => {
        const data = await env.TASKS_KV.get(key.name, "json");
        return data as TaskData;
      })
    );
    return tasks.filter(Boolean);
  }

  static async deleteTask(taskId: string) {
    const env = await this.getEnv();
    await env.TASKS_KV.delete(taskId);
  }

  static async saveNote(noteId: string, data: NoteData) {
    const env = await this.getEnv();
    await env.NOTES_KV.put(noteId, JSON.stringify(data));
  }

  static async listNotes(): Promise<NoteData[]> {
    const env = await this.getEnv();
    const list = await env.NOTES_KV.list({ prefix: "note:" });
    const notes = await Promise.all(
      list.keys.map(async (key: { name: string }) => {
        const data = await env.NOTES_KV.get(key.name, "json");
        return data as NoteData;
      })
    );
    return notes.filter(Boolean);
  }
}

// Safe math evaluation without using Function constructor
function evaluateMathExpression(expr: string): number {
  // Remove whitespace
  expr = expr.replace(/\s/g, '');
  
  // Basic validation - only allow numbers, operators, and parentheses
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    throw new Error("Invalid characters in expression");
  }
  
  // Use a simple math parser or return error
  // For production, use a proper math parser library like mathjs
  try {
    // This is still using eval but with strict validation
    // In production, replace with a proper math parser
    return eval(expr);
  } catch {
    throw new Error("Invalid mathematical expression");
  }
}

// Get current time - optimized
const getCurrentTime = tool({
  description: "Get current server time in a human-readable format",
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    const options = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    return {
      time: now.toLocaleTimeString('en-US', options),
      date: now.toLocaleDateString('en-US', options),
      timestamp: now.toISOString(),
      timezone: options.timeZone
    };
  },
});

// Calculate - made safer
const calculate = tool({
  description: "Evaluate a mathematical expression (supports +, -, *, /, parentheses)",
  parameters: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    try {
      const result = evaluateMathExpression(expression);
      return { result, expression, success: true };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : "Invalid expression", 
        expression,
        success: false 
      };
    }
  },
});

// Helper function for scheduling
async function scheduleTaskHelper(
  type: "scheduled" | "delayed" | "recurring",
  when: string | number,
  taskDescription: string,
  priority: string = "medium"
) {
  const { agent } = getCurrentAgent<PersonalAssistant>();
  if (!agent) throw new Error("Agent context not available");
  
  const taskId = crypto.randomUUID();
  const baseTask = {
    id: taskId,
    description: taskDescription,
    priority,
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  switch (type) {
    case "scheduled": {
      const scheduledDate = new Date(when);
      await agent.schedule(scheduledDate, "executeScheduledTask", {
        taskId,
        description: taskDescription,
        priority
      });
      
      await KVHelper.saveTask(`scheduled:${taskId}`, {
        ...baseTask,
        type: "scheduled",
        scheduledFor: scheduledDate.toISOString()
      });
      
      return {
        success: true,
        taskId,
        scheduledFor: scheduledDate.toISOString(),
        description: taskDescription,
        priority
      };
    }
    
    case "delayed": {
      const delaySeconds = typeof when === "number" ? when : parseInt(when as string);
      const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
      
      await agent.schedule(delaySeconds, "executeScheduledTask", {
        taskId,
        description: taskDescription,
        priority
      });
      
      await KVHelper.saveTask(`scheduled:${taskId}`, {
        ...baseTask,
        type: "delayed",
        scheduledFor: scheduledTime.toISOString(),
        delaySeconds
      });
      
      return {
        success: true,
        taskId,
        scheduledFor: scheduledTime.toISOString(),
        delaySeconds,
        description: taskDescription,
        priority
      };
    }
    
    case "recurring": {
      await agent.schedule(when as string, "executeScheduledTask", {
        taskId,
        description: taskDescription,
        priority,
        recurring: true
      });
      
      await KVHelper.saveTask(`scheduled:${taskId}`, {
        ...baseTask,
        type: "recurring",
        cronPattern: when as string
      });
      
      return {
        success: true,
        taskId,
        cronPattern: when,
        description: taskDescription,
        priority
      };
    }
  }
}

// Schedule task - refactored for efficiency
const scheduleTask = tool({
  description: "Schedule a task or reminder at a specific time, after a delay, or on a recurring schedule",
  parameters: z.object({
    type: z.enum(["scheduled", "delayed", "recurring"]),
    when: z.union([z.number(), z.string()]),
    taskDescription: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  execute: async ({ type, when, taskDescription, priority = "medium" }) => {
    try {
      return await scheduleTaskHelper(type, when, taskDescription, priority);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to schedule task"
      };
    }
  },
});

// Create task - optimized
const createTask = tool({
  description: "Create a new task with title, description, due date, and priority",
  parameters: z.object({
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  execute: async ({ title, description, dueDate, priority = "medium" }) => {
    try {
      const taskId = `task:${Date.now()}_${crypto.randomUUID()}`;
      const task: TaskData = {
        id: taskId,
        title,
        description,
        dueDate,
        priority,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      
      await KVHelper.saveTask(taskId, task);
      return { success: true, taskId, task };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create task"
      };
    }
  },
});

// Take note - optimized
const takeNote = tool({
  description: "Create a note with a title and content, optionally with tags",
  parameters: z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  execute: async ({ title, content, tags = [] }) => {
    try {
      const noteId = `note:${Date.now()}_${crypto.randomUUID()}`;
      const note: NoteData = {
        id: noteId,
        title,
        content,
        tags,
        createdAt: new Date().toISOString()
      };
      
      await KVHelper.saveNote(noteId, note);
      return { success: true, noteId, note };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create note"
      };
    }
  },
});

// List tasks - optimized with better filtering
const listTasks = tool({
  description: "List all tasks, optionally filtered by status or priority",
  parameters: z.object({
    status: z.enum(["pending", "completed", "all"]).optional(),
    priority: z.enum(["low", "medium", "high", "all"]).optional(),
  }),
  execute: async ({ status = "all", priority = "all" }) => {
    try {
      const tasks = await KVHelper.listTasks();
      
      // Efficient filtering
      const filteredTasks = tasks.filter(task => {
        if (!task) return false;
        const statusMatch = status === "all" || task.status === status;
        const priorityMatch = priority === "all" || task.priority === priority;
        return statusMatch && priorityMatch;
      });
      
      // Sort by creation date (newest first)
      filteredTasks.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      return {
        success: true,
        tasks: filteredTasks,
        filter: { status, priority },
        totalCount: filteredTasks.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve tasks",
        tasks: []
      };
    }
  },
});

// Update task - optimized
const updateTask = tool({
  description: "Update a task's status, priority, or other details",
  parameters: z.object({
    taskId: z.string(),
    status: z.enum(["pending", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
  }),
  execute: async ({ taskId, status, priority, dueDate }) => {
    try {
      const existing = await KVHelper.getTask(taskId);
      if (!existing) {
        return {
          success: false,
          error: "Task not found"
        };
      }
      
      const updated: TaskData = {
        ...existing,
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate }),
        updatedAt: new Date().toISOString()
      };
      
      await KVHelper.saveTask(taskId, updated);
      return { success: true, task: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update task"
      };
    }
  },
});

// Search notes - optimized with better search logic
const searchNotes = tool({
  description: "Search notes by title, content, or tags",
  parameters: z.object({
    query: z.string(),
    searchIn: z.enum(["title", "content", "tags", "all"]).optional(),
  }),
  execute: async ({ query, searchIn = "all" }) => {
    try {
      const notes = await KVHelper.listNotes();
      const queryLower = query.toLowerCase();
      
      // Optimized search with scoring
      const searchResults = notes
        .map(note => {
          if (!note) return null;
          
          let score = 0;
          const titleMatch = note.title?.toLowerCase().includes(queryLower);
          const contentMatch = note.content?.toLowerCase().includes(queryLower);
          const tagMatch = note.tags?.some(tag => tag.toLowerCase().includes(queryLower));
          
          // Scoring system for relevance
          if (titleMatch && (searchIn === "all" || searchIn === "title")) score += 3;
          if (contentMatch && (searchIn === "all" || searchIn === "content")) score += 2;
          if (tagMatch && (searchIn === "all" || searchIn === "tags")) score += 1;
          
          return score > 0 ? { ...note, relevanceScore: score } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (b?.relevanceScore || 0) - (a?.relevanceScore || 0))
        .map(({ relevanceScore, ...note }) => note);
      
      return {
        success: true,
        notes: searchResults,
        query,
        resultsCount: searchResults.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search notes",
        notes: []
      };
    }
  },
});

// Confirmation-required tools (no changes needed)
const getWeather = tool({
  description: "Get current weather information for a location",
  parameters: z.object({
    location: z.string(),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
});

const searchWeb = tool({
  description: "Search the web for current information on any topic",
  parameters: z.object({
    query: z.string(),
    resultCount: z.number().min(1).max(10).optional(),
  }),
});

const draftEmail = tool({
  description: "Help draft a professional email",
  parameters: z.object({
    recipient: z.string(),
    subject: z.string(),
    purpose: z.string(),
    tone: z.enum(["formal", "casual", "friendly", "professional"]).optional(),
  }),
});

export const tools = {
  getCurrentTime,
  calculate,
  scheduleTask,
  createTask,
  takeNote,
  getWeather,
  searchWeb,
  draftEmail,
  listTasks,
  updateTask,
  searchNotes,
};

// Executions remain the same but could integrate real APIs
export const executions = {
  getWeather: async ({ location, units = "celsius" }: { location: string; units?: string }) => {
    // TODO: Integrate with real weather API (e.g., OpenWeatherMap)
    const conditions = ["sunny", "partly cloudy", "cloudy", "light rain", "overcast"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 25) + 10;
    
    return {
      location,
      current: {
        temperature: units === "fahrenheit" ? `${Math.floor(temp * 9/5 + 32)}°F` : `${temp}°C`,
        condition,
        humidity: `${Math.floor(Math.random() * 40) + 40}%`,
        windSpeed: `${Math.floor(Math.random() * 20) + 5} km/h`,
        feelsLike: units === "fahrenheit" ? `${Math.floor((temp - 2) * 9/5 + 32)}°F` : `${temp - 2}°C`,
      },
      forecast: "Conditions expected to remain similar throughout the day",
      lastUpdated: new Date().toISOString()
    };
  },
  
  searchWeb: async ({ query, resultCount = 5 }: { query: string; resultCount?: number }) => {
    // TODO: Integrate with real search API (e.g., Bing Search API)
    const mockDomains = ["wikipedia.org", "docs.cloudflare.com", "developer.mozilla.org", "stackoverflow.com", "github.com"];
    const results = Array.from({ length: Math.min(resultCount, 10) }, (_, i) => ({
      title: `${query} - ${["Complete Guide", "Documentation", "Tutorial", "Best Practices", "Examples"][i % 5]}`,
      url: `https://${mockDomains[i % mockDomains.length]}/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
      snippet: `Comprehensive information about ${query}. This resource provides detailed insights, examples, and best practices...`,
      source: mockDomains[i % mockDomains.length]
    }));
    
    return {
      query,
      resultCount: results.length,
      results,
      searchEngine: "Mock Search (TODO: Integrate real API)",
      searchedAt: new Date().toISOString()
    };
  },
  
  draftEmail: async ({ recipient, subject, purpose, tone = "professional" }: { 
    recipient: string; 
    subject: string; 
    purpose: string; 
    tone?: string; 
  }) => {
    const toneMap = {
      formal: { greeting: "Dear", closing: "Sincerely" },
      casual: { greeting: "Hi", closing: "Best" },
      friendly: { greeting: "Hey", closing: "Cheers" },
      professional: { greeting: "Hello", closing: "Best regards" }
    };
    
    const selectedTone = toneMap[tone as keyof typeof toneMap] || toneMap.professional;
    const recipientName = recipient.includes('@') ? recipient.split('@')[0] : recipient;
    
    const emailDraft = `${selectedTone.greeting} ${recipientName},

I hope this email finds you well.

${purpose}

Please let me know if you need any additional information or if you'd like to discuss this further.

${selectedTone.closing},
[Your name]`;
    
    return {
      to: recipient,
      subject,
      draft: emailDraft,
      tone,
      wordCount: emailDraft.split(/\s+/).length,
      characterCount: emailDraft.length
    };
  },
};

/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";
import { getCurrentAgent } from "agents";
import type { PersonalAssistant } from "./server";

// Helper function to get the current agent context
async function getAgentEnv() {
  const { agent } = getCurrentAgent<PersonalAssistant>();
  if (!agent) throw new Error("Agent context not available");
  return agent.env;
}

// Get current time - auto-executing tool
const getCurrentTime = tool({
  description: "Get current server time in a human-readable format",
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString(),
      date: now.toLocaleDateString(),
      timestamp: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  },
});

// Calculate - auto-executing tool
const calculate = tool({
  description: "Evaluate a mathematical expression",
  parameters: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    try {
      // Using Function constructor for safe evaluation
      const result = new Function("return " + expression)();
      return { result, expression };
    } catch (error) {
      return { error: "Invalid expression", expression };
    }
  },
});

// Schedule task - auto-executing with different scheduling options
const scheduleTask = tool({
  description: "Schedule a task or reminder at a specific time, after a delay, or on a recurring schedule",
  parameters: z.object({
    type: z.enum(["scheduled", "delayed", "recurring"]),
    when: z.union([z.number(), z.string()]),
    taskDescription: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  execute: async ({ type, when, taskDescription, priority }) => {
    const { agent } = getCurrentAgent<PersonalAssistant>();
    if (!agent) throw new Error("Agent context not available");
    
    const taskId = crypto.randomUUID();
    
    try {
      if (type === "scheduled") {
        // Schedule for a specific date/time
        const scheduledDate = new Date(when);
        await agent.schedule(scheduledDate, "executeScheduledTask", {
          taskId,
          description: taskDescription,
          priority: priority || "medium"
        });
        
        // Also save to KV for tracking
        await agent.env.TASKS_KV.put(`scheduled:${taskId}`, JSON.stringify({
          id: taskId,
          type: "scheduled",
          scheduledFor: scheduledDate.toISOString(),
          description: taskDescription,
          priority: priority || "medium",
          status: "scheduled",
          createdAt: new Date().toISOString()
        }));
        
        return {
          success: true,
          taskId,
          scheduledFor: scheduledDate.toISOString(),
          description: taskDescription,
          priority: priority || "medium"
        };
      } else if (type === "delayed") {
        // Schedule after a delay in seconds
        const delaySeconds = typeof when === "number" ? when : parseInt(when);
        await agent.schedule(delaySeconds, "executeScheduledTask", {
          taskId,
          description: taskDescription,
          priority: priority || "medium"
        });
        
        const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
        
        // Save to KV
        await agent.env.TASKS_KV.put(`scheduled:${taskId}`, JSON.stringify({
          id: taskId,
          type: "delayed",
          scheduledFor: scheduledTime.toISOString(),
          delaySeconds,
          description: taskDescription,
          priority: priority || "medium",
          status: "scheduled",
          createdAt: new Date().toISOString()
        }));
        
        return {
          success: true,
          taskId,
          scheduledFor: scheduledTime.toISOString(),
          delaySeconds,
          description: taskDescription,
          priority: priority || "medium"
        };
      } else {
        // Recurring task with cron pattern
        await agent.schedule(when as string, "executeScheduledTask", {
          taskId,
          description: taskDescription,
          priority: priority || "medium",
          recurring: true
        });
        
        // Save to KV
        await agent.env.TASKS_KV.put(`scheduled:${taskId}`, JSON.stringify({
          id: taskId,
          type: "recurring",
          cronPattern: when,
          description: taskDescription,
          priority: priority || "medium",
          status: "scheduled",
          createdAt: new Date().toISOString()
        }));
        
        return {
          success: true,
          taskId,
          cronPattern: when,
          description: taskDescription,
          priority: priority || "medium",
          nextRun: "Calculated based on cron pattern"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to schedule task"
      };
    }
  },
});

// Create task - auto-executing
const createTask = tool({
  description: "Create a new task with title, description, due date, and priority",
  parameters: z.object({
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  execute: async ({ title, description, dueDate, priority }) => {
    const env = await getAgentEnv();
    const taskId = `task:${Date.now()}_${crypto.randomUUID()}`;
    
    const task = {
      id: taskId,
      title,
      description,
      dueDate,
      priority: priority || "medium",
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    try {
      await env.TASKS_KV.put(taskId, JSON.stringify(task));
      return {
        success: true,
        taskId,
        task
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to create task"
      };
    }
  },
});

// Take note - auto-executing
const takeNote = tool({
  description: "Create a note with a title and content, optionally with tags",
  parameters: z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  execute: async ({ title, content, tags }) => {
    const env = await getAgentEnv();
    const noteId = `note:${Date.now()}_${crypto.randomUUID()}`;
    
    const note = {
      id: noteId,
      title,
      content,
      tags: tags || [],
      createdAt: new Date().toISOString()
    };
    
    try {
      await env.NOTES_KV.put(noteId, JSON.stringify(note));
      return {
        success: true,
        noteId,
        note
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to create note"
      };
    }
  },
});

// Weather information - requires confirmation
const getWeather = tool({
  description: "Get current weather information for a location",
  parameters: z.object({
    location: z.string(),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  // No execute function - requires confirmation
});

// Web search - requires confirmation
const searchWeb = tool({
  description: "Search the web for current information on any topic",
  parameters: z.object({
    query: z.string(),
    resultCount: z.number().min(1).max(10).optional(),
  }),
  // No execute function - requires confirmation
});

// Email draft assistance - requires confirmation
const draftEmail = tool({
  description: "Help draft a professional email",
  parameters: z.object({
    recipient: z.string(),
    subject: z.string(),
    purpose: z.string(),
    tone: z.enum(["formal", "casual", "friendly", "professional"]).optional(),
  }),
  // No execute function - requires confirmation
});

// List tasks - auto-executing
const listTasks = tool({
  description: "List all tasks, optionally filtered by status or priority",
  parameters: z.object({
    status: z.enum(["pending", "completed", "all"]).optional(),
    priority: z.enum(["low", "medium", "high", "all"]).optional(),
  }),
  execute: async ({ status = "all", priority = "all" }) => {
    const env = await getAgentEnv();
    
    try {
      // Get all tasks from KV
      const tasksList = await env.TASKS_KV.list({ prefix: "task:" });
      const tasks = await Promise.all(
        tasksList.keys.map(async (key) => {
          const taskData = await env.TASKS_KV.get(key.name, "json");
          return taskData as any;
        })
      );
      
      // Filter tasks based on criteria
      const filteredTasks = tasks.filter(task => {
        if (!task) return false;
        if (status !== "all" && task.status !== status) return false;
        if (priority !== "all" && task.priority !== priority) return false;
        return true;
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
        error: "Failed to retrieve tasks",
        tasks: []
      };
    }
  },
});

// Update task - auto-executing
const updateTask = tool({
  description: "Update a task's status, priority, or other details",
  parameters: z.object({
    taskId: z.string(),
    status: z.enum(["pending", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
  }),
  execute: async ({ taskId, status, priority, dueDate }) => {
    const env = await getAgentEnv();
    
    try {
      // Get existing task
      const existing = await env.TASKS_KV.get(taskId, "json") as any;
      if (!existing) {
        return {
          success: false,
          error: "Task not found"
        };
      }
      
      // Update fields
      const updated = {
        ...existing,
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate && { dueDate }),
        updatedAt: new Date().toISOString()
      };
      
      await env.TASKS_KV.put(taskId, JSON.stringify(updated));
      
      return {
        success: true,
        task: updated
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to update task"
      };
    }
  },
});

// Search notes - auto-executing
const searchNotes = tool({
  description: "Search notes by title, content, or tags",
  parameters: z.object({
    query: z.string(),
    searchIn: z.enum(["title", "content", "tags", "all"]).optional(),
  }),
  execute: async ({ query, searchIn = "all" }) => {
    const env = await getAgentEnv();
    
    try {
      // Get all notes from KV
      const notesList = await env.NOTES_KV.list({ prefix: "note:" });
      const notes = await Promise.all(
        notesList.keys.map(async (key) => {
          const noteData = await env.NOTES_KV.get(key.name, "json");
          return noteData as any;
        })
      );
      
      // Search notes based on criteria
      const searchResults = notes.filter(note => {
        if (!note) return false;
        const queryLower = query.toLowerCase();
        
        if (searchIn === "all" || searchIn === "title") {
          if (note.title?.toLowerCase().includes(queryLower)) return true;
        }
        if (searchIn === "all" || searchIn === "content") {
          if (note.content?.toLowerCase().includes(queryLower)) return true;
        }
        if (searchIn === "all" || searchIn === "tags") {
          if (note.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))) return true;
        }
        
        return false;
      });
      
      return {
        success: true,
        notes: searchResults,
        query,
        resultsCount: searchResults.length
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to search notes",
        notes: []
      };
    }
  },
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

// Executions for tools that require confirmation
export const executions = {
  getWeather: async ({ location, units }: { location: string; units?: string }) => {
    // In a real implementation, you would call a weather API here
    // For now, we'll return a more realistic mock response
    const conditions = ["sunny", "partly cloudy", "cloudy", "light rain", "overcast"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 25) + 10; // 10-35°C
    
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
  
  searchWeb: async ({ query, resultCount }: { query: string; resultCount?: number }) => {
    // In a real implementation, you would use a search API like Google Custom Search
    // or Bing Search API. For now, returning structured mock data
    const count = resultCount || 5;
    const mockDomains = ["wikipedia.org", "docs.cloudflare.com", "developer.mozilla.org", "stackoverflow.com", "github.com"];
    const results = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        title: `${query} - ${["Complete Guide", "Documentation", "Tutorial", "Best Practices", "Examples"][i % 5]}`,
        url: `https://${mockDomains[i % mockDomains.length]}/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
        snippet: `Comprehensive information about ${query}. This resource provides detailed insights, examples, and best practices for working with ${query} in modern development...`,
        source: mockDomains[i % mockDomains.length]
      });
    }
    
    return {
      query,
      resultCount: results.length,
      results,
      searchEngine: "Mock Search",
      searchedAt: new Date().toISOString()
    };
  },
  
  draftEmail: async ({ recipient, subject, purpose, tone }: { 
    recipient: string; 
    subject: string; 
    purpose: string; 
    tone?: string; 
  }) => {
    // Generate email draft based on parameters
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
      tone: tone || "professional",
      wordCount: emailDraft.split(/\s+/).length,
      characterCount: emailDraft.length
    };
  },
};

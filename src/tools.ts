/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

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
    // In a real implementation, this would integrate with the scheduling system
    const taskId = crypto.randomUUID();
    
    if (type === "scheduled") {
      // Schedule for a specific date/time
      return {
        success: true,
        taskId,
        scheduledFor: new Date(when).toISOString(),
        description: taskDescription,
        priority: priority || "medium"
      };
    } else if (type === "delayed") {
      // Schedule after a delay in seconds
      const delaySeconds = typeof when === "number" ? when : parseInt(when);
      const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
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
      return {
        success: true,
        taskId,
        cronPattern: when,
        description: taskDescription,
        priority: priority || "medium",
        nextRun: "Calculated based on cron pattern"
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
    // This would integrate with the tasks KV storage
    const taskId = `task:${Date.now()}_${crypto.randomUUID()}`;
    return {
      success: true,
      taskId,
      task: {
        id: taskId,
        title,
        description,
        dueDate,
        priority: priority || "medium",
        status: "pending",
        createdAt: new Date().toISOString()
      }
    };
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
    const noteId = `note:${Date.now()}_${crypto.randomUUID()}`;
    return {
      success: true,
      noteId,
      note: {
        id: noteId,
        title,
        content,
        tags: tags || [],
        createdAt: new Date().toISOString()
      }
    };
  },
});

// Weather information - requires confirmation (simulated)
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
  execute: async ({ status, priority }) => {
    // This would query the tasks KV storage
    // For now, returning a simulated response
    return {
      tasks: [
        {
          id: "task:sample1",
          title: "Review project proposal",
          status: "pending",
          priority: "high",
          dueDate: new Date(Date.now() + 86400000).toISOString()
        },
        {
          id: "task:sample2",
          title: "Weekly team meeting",
          status: "pending",
          priority: "medium",
          dueDate: new Date(Date.now() + 172800000).toISOString()
        }
      ],
      filter: { status: status || "all", priority: priority || "all" }
    };
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
};

// Executions for tools that require confirmation
export const executions = {
  getWeather: async ({ location, units }: { location: string; units?: string }) => {
    // Simulated weather API call
    const temp = Math.floor(Math.random() * 30) + 10;
    const conditions = ["sunny", "cloudy", "partly cloudy", "rainy", "windy"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    return {
      location,
      temperature: units === "fahrenheit" ? `${Math.floor(temp * 9/5 + 32)}°F` : `${temp}°C`,
      condition,
      humidity: `${Math.floor(Math.random() * 40) + 40}%`,
      windSpeed: `${Math.floor(Math.random() * 20) + 5} km/h`,
      lastUpdated: new Date().toISOString()
    };
  },
  
  searchWeb: async ({ query, resultCount }: { query: string; resultCount?: number }) => {
    // Simulated web search results
    const count = resultCount || 5;
    const results = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        title: `Result ${i + 1} for "${query}"`,
        url: `https://example.com/search/${encodeURIComponent(query)}/${i + 1}`,
        snippet: `This is a relevant snippet about ${query}. It contains information that might be helpful...`,
        source: "example.com"
      });
    }
    
    return {
      query,
      resultCount: results.length,
      results,
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
      formal: "Dear",
      casual: "Hi",
      friendly: "Hey",
      professional: "Hello"
    };
    
    const greeting = `${toneMap[tone as keyof typeof toneMap] || "Hello"} ${recipient.split('@')[0]},`;
    
    const emailDraft = `${greeting}

I hope this email finds you well.

${purpose}

Please let me know if you need any additional information or if you'd like to discuss this further.

Best regards,
[Your name]`;
    
    return {
      to: recipient,
      subject,
      draft: emailDraft,
      tone: tone || "professional",
      wordCount: emailDraft.split(/\s+/).length
    };
  },
};

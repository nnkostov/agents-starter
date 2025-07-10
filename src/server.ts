import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Agent } from "agents";
import { tools } from "./tools";
import { z } from "zod";

export interface Env {
  OPENAI_API_KEY: string;
  PersonalAssistant: DurableObjectNamespace;
  TASKS_KV: KVNamespace;
  NOTES_KV: KVNamespace;
}

// Validation schemas
const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["pending", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional(),
});

const NoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

interface Task extends z.infer<typeof TaskSchema> {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

interface Note extends z.infer<typeof NoteSchema> {
  id: string;
  createdAt: string;
}

interface ScheduledTaskData {
  taskId: string;
  description: string;
  priority: string;
  recurring?: boolean;
}

// Helper for consistent error responses
class APIError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

// Helper for consistent API responses
function createResponse(data: any, status: number = 200): Response {
  return Response.json(data, { status });
}

function createErrorResponse(error: unknown): Response {
  if (error instanceof APIError) {
    return createResponse({ error: error.message }, error.statusCode);
  }
  if (error instanceof z.ZodError) {
    return createResponse({ error: "Validation error", details: error.errors }, 400);
  }
  console.error("Unexpected error:", error);
  return createResponse({ error: "Internal server error" }, 500);
}

export class PersonalAssistant extends Agent<Env> {
  // Route handler with improved efficiency
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // API route mapping for efficiency
      const routes: Record<string, () => Promise<Response>> = {
        "/stream": () => this.streamResponse(request),
        "/tasks": () => this.handleTasks(request),
        "/notes": () => this.handleNotes(request),
        "/scheduled": () => this.getScheduledTasks(),
      };
      
      // Find matching route
      for (const [route, handler] of Object.entries(routes)) {
        if (path.endsWith(route)) {
          return await handler();
        }
      }
      
      return createResponse({ message: "Personal Assistant API", version: "1.0" });
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  // Optimized scheduled task execution
  async executeScheduledTask(data: ScheduledTaskData): Promise<void> {
    const { taskId, description, priority, recurring } = data;
    console.log(`Executing scheduled task: ${taskId} - ${description}`);
    
    const task: Task = {
      id: `task:${Date.now()}_${crypto.randomUUID()}`,
      title: description,
      description: `Scheduled task executed at ${new Date().toISOString()}`,
      priority: priority as "low" | "medium" | "high",
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    try {
      // @ts-ignore - env is available in the Agent runtime context
      const env = this.env as Env;
      
      // Save task in a transaction-like manner
      await env.TASKS_KV.put(task.id, JSON.stringify(task));
      
      if (!recurring) {
        await env.TASKS_KV.delete(`scheduled:${taskId}`);
      }
      
      console.log(`Task created from schedule: ${task.id}`);
    } catch (error) {
      console.error(`Failed to execute scheduled task:`, error);
      // Could implement retry logic here
    }
  }

  private async streamResponse(request: Request): Promise<Response> {
    const messages = await request.json();
    const model = openai("gpt-4o-2024-11-20");

    const result = streamText({
      model,
      messages,
      tools,
      system: `You are a highly capable and friendly personal assistant. Your personality is:
- Professional yet warm and approachable
- Proactive in offering helpful suggestions
- Detail-oriented and organized
- Empathetic and understanding of user needs
- Efficient in task management and scheduling

Your capabilities include:
1. Task Management - Creating, tracking, organizing, and updating tasks
2. Scheduling - Setting reminders, appointments, and recurring events
3. Note Taking - Capturing and organizing thoughts and information
4. Information Retrieval - Searching the web for current information
5. Calculations - Performing mathematical operations
6. Weather Updates - Providing weather information
7. Email Assistance - Helping draft professional emails
8. Daily Planning - Organizing daily schedules and priorities

Available tools you can use:
- getCurrentTime: Get current date and time
- calculate: Perform mathematical calculations
- scheduleTask: Schedule one-time, delayed, or recurring tasks
- createTask: Create a new task with details
- takeNote: Create a note with optional tags
- listTasks: List tasks with optional filters
- updateTask: Update task status or details
- searchNotes: Search through notes
- getWeather: Get weather information (requires confirmation)
- searchWeb: Search the internet (requires confirmation)
- draftEmail: Generate email drafts (requires confirmation)

Always aim to:
- Anticipate user needs based on context
- Provide clear, actionable responses
- Offer to help with follow-up tasks
- Remember context from the conversation
- Be respectful of the user's time
- Use the appropriate tools to help the user`,
      maxSteps: 10,
      onStepFinish: (event: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(JSON.stringify(event, null, 2));
        }
      },
    });

    return result.toDataStreamResponse();
  }

  // Generalized KV list handler for efficiency
  private async listFromKV(prefix: string): Promise<any[]> {
    const list = await this.env.TASKS_KV.list({ prefix, limit: 1000 });
    const items = await Promise.all(
      list.keys.map(async ({ name }) => {
        try {
          return await this.env.TASKS_KV.get(name, "json");
        } catch {
          return null; // Handle corrupted data gracefully
        }
      })
    );
    return items.filter(Boolean);
  }

  private async handleTasks(request: Request): Promise<Response> {
    const method = request.method;
    
    switch (method) {
      case "GET": {
        const tasks = await this.listFromKV("task:");
        return createResponse({ 
          tasks, 
          count: tasks.length,
          timestamp: new Date().toISOString() 
        });
      }
      
      case "POST": {
        const body = await request.json();
        const validated = TaskSchema.parse(body);
        
        const task: Task = {
          id: `task:${Date.now()}_${crypto.randomUUID()}`,
          ...validated,
          status: validated.status || "pending",
          priority: validated.priority || "medium",
          createdAt: new Date().toISOString()
        };
        
        await this.env.TASKS_KV.put(task.id, JSON.stringify(task));
        return createResponse({ success: true, task }, 201);
      }
      
      case "PUT": {
        const { taskId, ...updates } = await request.json();
        if (!taskId) throw new APIError("taskId is required");
        
        const existing = await this.env.TASKS_KV.get(taskId, "json") as Task | null;
        if (!existing) throw new APIError("Task not found", 404);
        
        // Validate only the update fields
        const validatedUpdates = TaskSchema.partial().parse(updates);
        
        const updated: Task = {
          ...existing,
          ...validatedUpdates,
          updatedAt: new Date().toISOString()
        };
        
        await this.env.TASKS_KV.put(taskId, JSON.stringify(updated));
        return createResponse({ success: true, task: updated });
      }
      
      case "DELETE": {
        const { taskId } = await request.json();
        if (!taskId) throw new APIError("taskId is required");
        
        await this.env.TASKS_KV.delete(taskId);
        return createResponse({ success: true, message: "Task deleted" });
      }
      
      default:
        throw new APIError("Method not allowed", 405);
    }
  }

  private async handleNotes(request: Request): Promise<Response> {
    const method = request.method;
    
    switch (method) {
      case "GET": {
        const notes = await this.listFromKV("note:");
        return createResponse({ 
          notes, 
          count: notes.length,
          timestamp: new Date().toISOString() 
        });
      }
      
      case "POST": {
        const body = await request.json();
        const validated = NoteSchema.parse(body);
        
        const note: Note = {
          id: `note:${Date.now()}_${crypto.randomUUID()}`,
          ...validated,
          tags: validated.tags || [],
          createdAt: new Date().toISOString()
        };
        
        await this.env.NOTES_KV.put(note.id, JSON.stringify(note));
        return createResponse({ success: true, note }, 201);
      }
      
      case "DELETE": {
        const { noteId } = await request.json();
        if (!noteId) throw new APIError("noteId is required");
        
        await this.env.NOTES_KV.delete(noteId);
        return createResponse({ success: true, message: "Note deleted" });
      }
      
      default:
        throw new APIError("Method not allowed", 405);
    }
  }
  
  private async getScheduledTasks(): Promise<Response> {
    const scheduled = await this.listFromKV("scheduled:");
    return createResponse({ 
      scheduled, 
      count: scheduled.length,
      timestamp: new Date().toISOString() 
    });
  }
}

// Optimized main handler
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // CORS configuration
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests efficiently
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Validate environment
      if (!env.OPENAI_API_KEY && process.env.NODE_ENV !== 'development') {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      // Route to the personal assistant durable object
      const id = env.PersonalAssistant.idFromName("main-assistant");
      const assistant = env.PersonalAssistant.get(id);
      
      // Forward request to assistant
      const response = await assistant.fetch(request);
      
      // Clone response to add CORS headers
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error("Worker error:", error);
      return Response.json(
        { error: "Service unavailable" }, 
        { status: 503, headers: corsHeaders }
      );
    }
  },
};

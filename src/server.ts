import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Agent } from "agents";
import { tools } from "./tools";

export interface Env {
  OPENAI_API_KEY: string;
  PersonalAssistant: DurableObjectNamespace;
  TASKS_KV: KVNamespace;
  NOTES_KV: KVNamespace;
}

interface Task {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Note {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
}

export class PersonalAssistant extends Agent<Env> {
  async fetch(request: Request) {
    if (request.url.endsWith("/stream")) {
      return this.streamResponse(request);
    }
    
    // Handle other endpoints for personal assistant features
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.endsWith("/tasks")) {
      return this.handleTasks(request);
    }
    
    if (path.endsWith("/notes")) {
      return this.handleNotes(request);
    }
    
    return new Response("Personal Assistant API", { status: 200 });
  }

  private async streamResponse(request: Request) {
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
1. Task Management - Creating, tracking, and organizing tasks
2. Scheduling - Setting reminders, appointments, and recurring events
3. Note Taking - Capturing and organizing thoughts and information
4. Information Retrieval - Searching the web for current information
5. Calculations - Performing mathematical operations
6. Weather Updates - Providing weather information
7. Email Assistance - Helping draft professional emails
8. Daily Planning - Organizing daily schedules and priorities

Always aim to:
- Anticipate user needs based on context
- Provide clear, actionable responses
- Offer to help with follow-up tasks
- Remember context from the conversation
- Be respectful of the user's time`,
      maxSteps: 10,
      onStepFinish: (event: any) => {
        console.log(JSON.stringify(event, null, 2));
      },
    });

    return result.toDataStreamResponse();
  }

  private async handleTasks(request: Request) {
    const method = request.method;
    
    if (method === "GET") {
      // Retrieve all tasks
      const tasks = await this.env.TASKS_KV.list({ prefix: "task:" });
      const taskList = await Promise.all(
        tasks.keys.map(async (key: any) => {
          const task = await this.env.TASKS_KV.get(key.name, "json");
          return task;
        })
      );
      return Response.json({ tasks: taskList.filter(Boolean) });
    }
    
    if (method === "POST") {
      // Create a new task
      const task: Task = await request.json();
      const taskId = `task:${Date.now()}_${crypto.randomUUID()}`;
      await this.env.TASKS_KV.put(taskId, JSON.stringify({
        id: taskId,
        ...task,
        createdAt: new Date().toISOString(),
        status: task.status || "pending"
      }));
      return Response.json({ success: true, taskId });
    }
    
    if (method === "PUT") {
      // Update a task
      const body: { taskId: string; [key: string]: any } = await request.json();
      const { taskId, ...updates } = body;
      const existing = await this.env.TASKS_KV.get(taskId, "json") as Task | null;
      if (!existing) {
        return Response.json({ error: "Task not found" }, { status: 404 });
      }
      await this.env.TASKS_KV.put(taskId, JSON.stringify({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      }));
      return Response.json({ success: true });
    }
    
    if (method === "DELETE") {
      // Delete a task
      const { taskId } = await request.json();
      await this.env.TASKS_KV.delete(taskId);
      return Response.json({ success: true });
    }
    
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  private async handleNotes(request: Request) {
    const method = request.method;
    
    if (method === "GET") {
      // Retrieve all notes
      const notes = await this.env.NOTES_KV.list({ prefix: "note:" });
      const noteList = await Promise.all(
        notes.keys.map(async (key: any) => {
          const note = await this.env.NOTES_KV.get(key.name, "json");
          return note;
        })
      );
      return Response.json({ notes: noteList.filter(Boolean) });
    }
    
    if (method === "POST") {
      // Create a new note
      const note: Note = await request.json();
      const noteId = `note:${Date.now()}_${crypto.randomUUID()}`;
      await this.env.NOTES_KV.put(noteId, JSON.stringify({
        id: noteId,
        ...note,
        createdAt: new Date().toISOString()
      }));
      return Response.json({ success: true, noteId });
    }
    
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Enable CORS
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Route to the personal assistant durable object
    const id = env.PersonalAssistant.idFromName("main-assistant");
    const assistant = env.PersonalAssistant.get(id);
    const response = await assistant.fetch(request);
    
    // Add CORS headers to response
    const newResponse = new Response(response.body, response);
    Object.entries(headers).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    
    return newResponse;
  },
};

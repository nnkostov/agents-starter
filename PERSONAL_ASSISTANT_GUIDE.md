# Personal Assistant Agent

## Overview

This is a comprehensive personal assistant built on the Cloudflare Agents framework. It provides intelligent task management, scheduling, note-taking, and various productivity features through a conversational interface.

## Features

### Core Capabilities

1. **Task Management**
   - Create tasks with title, description, priority, and due dates
   - List and filter tasks by status or priority
   - Update task status and details
   - Delete completed or unwanted tasks

2. **Scheduling & Reminders**
   - Schedule one-time tasks for specific dates/times
   - Set delayed reminders (e.g., "remind me in 30 minutes")
   - Create recurring tasks with cron patterns
   - View and manage scheduled items

3. **Note Taking**
   - Create notes with titles and content
   - Organize notes with tags
   - Quick capture of thoughts and information
   - Retrieve notes by searching

4. **Information Services**
   - Web search for current information (requires confirmation)
   - Weather updates for any location (requires confirmation)
   - Mathematical calculations
   - Current time and date information

5. **Communication Assistance**
   - Draft professional emails (requires confirmation)
   - Adjust tone: formal, casual, friendly, or professional
   - Generate subject lines and content based on purpose

## Architecture

### Backend Components

- **PersonalAssistant Agent**: Main Durable Object handling all assistant logic
- **KV Storage**: 
  - `TASKS_KV`: Stores all task data
  - `NOTES_KV`: Stores all notes data
- **AI Integration**: Uses OpenAI GPT-4 for natural language understanding

### Frontend Features

- Modern React-based UI with TypeScript
- Dark/Light theme support
- Real-time streaming responses
- Tool confirmation dialogs for sensitive operations
- Persistent message history
- Responsive design for all devices

## Available Tools

### Auto-executing Tools (No confirmation needed)
- `getCurrentTime`: Get current date/time information
- `calculate`: Perform mathematical calculations
- `scheduleTask`: Schedule tasks and reminders
- `createTask`: Create new tasks
- `takeNote`: Create notes
- `listTasks`: View and filter tasks

### Confirmation-required Tools
- `getWeather`: Get weather information
- `searchWeb`: Search the internet
- `draftEmail`: Generate email drafts

## Usage Examples

### Task Management
- "Create a task to review the project proposal tomorrow"
- "Show me all high priority tasks"
- "Mark the meeting preparation task as completed"

### Scheduling
- "Schedule a reminder to call John at 3 PM"
- "Remind me to take a break in 30 minutes"
- "Set up a recurring task to check emails every morning at 9 AM"

### Note Taking
- "Take a note about the meeting highlights"
- "Create a note titled 'Project Ideas' with my brainstorming points"

### Information & Assistance
- "What's the weather in San Francisco?"
- "Calculate 15% tip on $85.50"
- "Search for the latest AI developments"
- "Help me draft an email to my team about the project update"

## Development

### Local Setup
```bash
# Install dependencies
npm install

# Create environment variables
cp .dev.vars.example .dev.vars
# Add your OPENAI_API_KEY to .dev.vars

# Run locally
npm start
```

### Deployment
```bash
# Deploy to Cloudflare
npm run deploy
```

### Environment Variables
- `OPENAI_API_KEY`: Required for AI functionality

### Adding New Features

1. **New Tools**: Add tool definitions in `src/tools.ts`
2. **New Endpoints**: Add handlers in `PersonalAssistant` class
3. **UI Updates**: Modify `src/app.tsx` for interface changes

## API Endpoints

- `POST /stream`: Main chat interface for AI interactions
- `GET /tasks`: Retrieve all tasks
- `POST /tasks`: Create a new task
- `PUT /tasks`: Update an existing task
- `DELETE /tasks`: Delete a task
- `GET /notes`: Retrieve all notes
- `POST /notes`: Create a new note

## Security & Privacy

- All data is stored in your Cloudflare account
- No data is shared with third parties (except OpenAI for processing)
- Tool confirmations ensure sensitive actions are authorized
- CORS headers configured for security

## Future Enhancements

- Calendar integration
- Voice input/output
- File attachments for notes
- Task collaboration features
- Advanced search capabilities
- Custom tool creation interface
- Mobile app support
# Cloudflare Agents Starter Kit - AI Assistant Context

## Overview

This repository is a **Cloudflare Agents Starter Kit** - a template for building AI-powered chat agents using Cloudflare's Agent platform. It provides a complete foundation for creating interactive chat experiences with AI, featuring a modern React-based UI and sophisticated tool integration capabilities.

### Key Technologies
- **Cloudflare Workers**: Serverless edge computing platform
- **Cloudflare Agents SDK** (`agents` package): For building AI agents with state management
- **React**: Frontend UI framework
- **TypeScript**: Type-safe development
- **Vite**: Build tool and dev server
- **AI SDK** (`ai` package): Vercel's AI SDK for streaming responses
- **OpenAI SDK**: Default AI provider (configurable)
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components

## Project Structure

```
├── src/
│   ├── app.tsx              # Main React UI - chat interface, message handling, tool confirmations
│   ├── server.ts            # Chat agent logic - AI integration, streaming responses
│   ├── tools.ts             # Tool definitions - search, calculate, schedule tasks
│   ├── utils.ts             # Helper functions - agent client creation, message parsing
│   ├── client.tsx           # React app entry point
│   ├── shared.ts            # Shared types and constants
│   ├── styles.css           # Global styles and Tailwind directives
│   ├── components/          # Reusable UI components
│   │   ├── button/          # Button component with variants
│   │   ├── card/            # Card component for messages
│   │   ├── modal/           # Modal dialog component
│   │   ├── dropdown/        # Dropdown menu component
│   │   └── ...              # Other UI components
│   ├── hooks/               # Custom React hooks
│   │   ├── useTheme.ts      # Theme management hook
│   │   ├── useClickOutside.tsx  # Click outside detection
│   │   └── useMenuNavigation.tsx # Keyboard navigation
│   └── providers/           # React context providers
│       ├── ModalProvider.tsx     # Modal state management
│       ├── TooltipProvider.tsx   # Tooltip state management
│       └── index.tsx             # Provider exports
├── public/                  # Static assets
├── tests/                   # Test files
├── wrangler.jsonc           # Cloudflare Workers configuration
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
└── worker-configuration.d.ts # Worker type definitions
```

## Key Files Explained

### `src/server.ts`
The backend agent logic that:
- Implements the `/stream` endpoint for AI chat interactions
- Uses OpenAI's API (configurable to other providers)
- Handles tool calls and streaming responses
- Manages conversation history

### `src/app.tsx`
The main React UI component that:
- Renders the chat interface
- Handles message input and display
- Manages tool confirmation dialogs
- Implements theme switching (dark/light)
- Connects to the agent via WebSocket or HTTP

### `src/tools.ts`
Defines available tools that the AI can use:
- **Search Database**: Requires user confirmation
- **Calculate**: Auto-executes mathematical operations
- **Get Current Time**: Auto-executes to return current time
- **Schedule Task**: Supports one-time, delayed, and recurring tasks via cron

### `src/utils.ts`
Helper utilities including:
- `createAgentClient()`: Creates WebSocket or HTTP connections to agents
- `parseStreamingDataResponse()`: Handles streaming AI responses
- Message formatting and parsing functions

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Create environment variables
cp .dev.vars.example .dev.vars
# Add your OPENAI_API_KEY to .dev.vars

# Start development server
npm start
# Visit http://localhost:8787
```

### Deployment
```bash
# Build and deploy to Cloudflare
npm run deploy
```

### Running Tests
```bash
npm test
```

## Tool System

The agent supports two types of tools:

1. **Auto-executing tools**: Have an `execute` function and run immediately
2. **Confirmation-required tools**: No `execute` function, require user approval

### Adding New Tools

1. Define the tool in `src/tools.ts`:
```typescript
const myNewTool = tool({
  description: "Tool description for AI",
  parameters: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  // Optional: include execute for auto-execution
  execute: async ({ param1, param2 }) => {
    // Tool logic here
    return result;
  }
});
```

2. If confirmation is required, add execution handler to `executions` object:
```typescript
export const executions = {
  myNewTool: async ({ param1, param2 }) => {
    // Implementation when user confirms
    return result;
  },
  // ... other handlers
};
```

3. Update `toolsRequiringConfirmation` in `app.tsx` if needed.

## AI Provider Configuration

The starter uses OpenAI by default but supports multiple providers:

### Use Workers AI
```bash
npm install workers-ai-provider
```

Update `wrangler.jsonc`:
```jsonc
"ai": {
  "binding": "AI"
}
```

Update `src/server.ts` to use Workers AI instead of OpenAI.

### Use Anthropic
```bash
npm install @anthropic-ai/sdk
```

Replace OpenAI imports and client initialization with Anthropic.

## State Management

The project uses:
- React state for UI components
- Agent state management via `agents` SDK
- WebSocket connections for real-time updates
- Tool confirmation state in the modal system

## Styling and UI

- Uses Tailwind CSS for utility classes
- Custom CSS variables for theming
- Radix UI for accessible, headless components
- Dark/light theme support with system preference detection

## Best Practices

1. **Security**: Never hardcode API keys - use environment variables
2. **Error Handling**: Implement proper error boundaries and user feedback
3. **Performance**: Use streaming for AI responses to improve UX
4. **Accessibility**: Leverage Radix UI components for ARIA compliance
5. **Type Safety**: Utilize TypeScript for all new code

## Common Customizations

### Add Authentication
- Integrate with Cloudflare Access or custom auth
- Store user sessions in Workers KV
- Add user context to AI conversations

### Persist Chat History
- Use Durable Objects for real-time sync
- Store in D1 database for long-term persistence
- Implement chat session management

### Custom UI Theme
- Modify CSS variables in `styles.css`
- Update Tailwind configuration
- Add custom components to match brand

### Enhanced Tools
- Database integration (D1, KV, or external)
- API integrations (REST/GraphQL)
- File processing (R2 storage)
- Email/notification sending

## Cloudflare-Specific Features

This project can leverage:
- **Workers KV**: Key-value storage for configuration
- **Durable Objects**: Stateful, strongly consistent storage
- **D1**: SQL database for structured data
- **R2**: Object storage for files
- **Queues**: Asynchronous task processing
- **Browser Rendering**: Headless browser capabilities
- **Workers AI**: Built-in AI inference

## Debugging Tips

1. Use `wrangler tail` to view live logs
2. Enable observability in `wrangler.jsonc`
3. Use browser DevTools for frontend debugging
4. Check network tab for WebSocket/HTTP traffic
5. Use `console.log` in both frontend and backend code

## References

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Agents NPM Package](https://www.npmjs.com/package/agents)
# AI Chat API - OpenAI Compatible

This document demonstrates how to use the OpenAI-compatible chat completions API implemented in the `ai-chat` module.

## Endpoints

### Primary Endpoint (OpenAI Compatible)

**POST** `/chat/completions`

This endpoint is fully compatible with OpenAI's chat completions API format and handles both streaming and non-streaming requests in a single endpoint.

### Alternative SSE Endpoint (NestJS Pattern)

**GET** `/chat/stream`

This endpoint uses NestJS's native `@Sse` decorator pattern for streaming responses.

## Why Two Approaches?

You asked about using the `@Sse` decorator, and you're absolutely right! Here's why I implemented both:

1. **OpenAI Compatibility**: The `/chat/completions` endpoint maintains 100% compatibility with OpenAI's API, including the ability to handle both streaming and non-streaming in the same POST endpoint based on the `stream` parameter.

2. **NestJS Best Practices**: The `/chat/stream` endpoint uses NestJS's `@Sse` decorator, which is more idiomatic and leverages NestJS's built-in SSE handling.

The main endpoint prioritizes OpenAI compatibility, while the alternative endpoint demonstrates proper NestJS SSE usage.

## Model Configuration

**Important**: The `model` field in requests is kept only for OpenAI API compatibility. Internally, the service **always uses `gpt-5`** regardless of what model is specified in the request.

- ✅ Request `model` field: For API compatibility only
- ✅ Internal model: Always `gpt-5` (defined in `DEFAULT_MODEL` constant)
- ✅ Response `model` field: Echoes the request model for compatibility

## Features

- ✅ OpenAI-compatible request/response format
- ✅ Streaming support with Server-Sent Events (SSE)
- ✅ Integration with AI module's agent (LangChain + tools)
- ✅ Automatic system prompt injection for medical EMR context
- ✅ Request validation using NestJS decorators
- ✅ Token usage estimation
- ✅ Error handling
- ✅ Both manual SSE and `@Sse` decorator implementations
- ✅ Fixed internal model (gpt-5) with API compatibility layer

## Request Format

### Primary Endpoint

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are the symptoms of diabetes?"
    }
  ],
  "model": "gpt-4o-mini",
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Note**: The `model` field above can be any OpenAI-compatible model name for API compatibility, but internally the service will always use `gpt-5`.

### Alternative SSE Endpoint

```
GET /chat/stream?messages=[{"role":"user","content":"What are diabetes symptoms?"}]&model=gpt-4o-mini
```

## Response Format

### Non-Streaming Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699123456,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Diabetes symptoms include frequent urination, excessive thirst, unexplained weight loss..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 85,
    "total_tokens": 100
  },
  "system_fingerprint": "fp_1699123456"
}
```

**Note**: The response `model` field echoes the request model for API compatibility, but the actual processing was done using `gpt-5`.

### Streaming Response (Primary Endpoint)

When `stream: true` is set, the API returns Server-Sent Events:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1699123456,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1699123456,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Diabetes symptoms include"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1699123456,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" frequent urination,"},"finish_reason":null}]}

data: [DONE]
```

### Streaming Response (NestJS SSE Endpoint)

The alternative endpoint returns NestJS MessageEvent format:

```
data: {"data":{"id":"chatcmpl-abc123","object":"chat.completion.chunk",...},"type":"message"}
```

## Examples

### JavaScript/TypeScript (Primary Endpoint)

```javascript
// Non-streaming request
const response = await fetch('http://localhost:3000/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'What are the normal blood pressure ranges?',
      },
    ],
    model: 'gpt-4o-mini', // For compatibility only - internally uses gpt-5
    temperature: 0.7,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
// Response will show model: "gpt-4o-mini" but was processed with gpt-5
```

```javascript
// Streaming request
const response = await fetch('http://localhost:3000/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Explain hypertension treatment options',
      },
    ],
    model: 'gpt-4', // For compatibility only - internally uses gpt-5
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log('Stream completed');
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          console.log(content);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}
```

### JavaScript/TypeScript (NestJS SSE Endpoint)

```javascript
// Using the NestJS SSE endpoint
const messages = JSON.stringify([
  { role: 'user', content: 'What are diabetes symptoms?' },
]);

const eventSource = new EventSource(
  `http://localhost:3000/chat/stream?messages=${encodeURIComponent(messages)}&model=gpt-4o-mini`,
);

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  const content = data.data.choices[0]?.delta?.content;
  if (content) {
    console.log(content);
  }
};

eventSource.onerror = function (error) {
  console.error('EventSource error:', error);
  eventSource.close();
};
```

### cURL

```bash
# Non-streaming (Primary endpoint)
curl -X POST http://localhost:3000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is the ICD-10 code for Type 2 diabetes?"
      }
    ],
    "model": "gpt-4o-mini"
  }'

# Streaming (Primary endpoint)
curl -X POST http://localhost:3000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Explain the treatment protocol for pneumonia"
      }
    ],
    "model": "gpt-3.5-turbo",
    "stream": true
  }'

# NestJS SSE endpoint
curl "http://localhost:3000/chat/stream?messages=%5B%7B%22role%22%3A%22user%22%2C%22content%22%3A%22What%20are%20diabetes%20symptoms%3F%22%7D%5D&model=gpt-4o-mini"
```

### Python

```python
import requests
import json

# Non-streaming
response = requests.post(
    'http://localhost:3000/chat/completions',
    headers={'Content-Type': 'application/json'},
    json={
        'messages': [
            {
                'role': 'user',
                'content': 'What are the contraindications for aspirin?'
            }
        ],
        'model': 'gpt-4o-mini'  # For compatibility only - internally uses gpt-5
    }
)

data = response.json()
print(f"Model in response: {data['model']}")  # Will show gpt-4o-mini
print(f"Content: {data['choices'][0]['message']['content']}")  # Generated with gpt-5

# Streaming
response = requests.post(
    'http://localhost:3000/chat/completions',
    headers={'Content-Type': 'application/json'},
    json={
        'messages': [
            {
                'role': 'user',
                'content': 'Describe the pathophysiology of heart failure'
            }
        ],
        'model': 'gpt-4',  # For compatibility only - internally uses gpt-5
        'stream': True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]':
                break
            try:
                parsed = json.loads(data)
                content = parsed['choices'][0]['delta'].get('content', '')
                if content:
                    print(content, end='')
            except json.JSONDecodeError:
                pass
```

## Implementation Details

### Model Handling

The service implements a dual-layer approach for model handling:

1. **API Compatibility Layer**:
   - Accepts any model name in requests
   - Echoes the same model name in responses
   - Maintains full OpenAI API compatibility

2. **Internal Processing Layer**:
   - Always uses `DEFAULT_MODEL` constant (`gpt-5`)
   - Ignores the request model completely
   - Logs both request and internal models for debugging

```typescript
// Model constants (src/ai-chat/constants/models.ts)
export const DEFAULT_MODEL = 'gpt-5';

// In service - request model is only used for response compatibility
const responseModel = request.model || 'gpt-4o-mini';
// But internally, we always use DEFAULT_MODEL for processing
```

### Why Both Approaches?

1. **Primary Endpoint** (`/chat/completions`):
   - ✅ 100% OpenAI API compatible
   - ✅ Single endpoint for both streaming and non-streaming
   - ✅ Handles SSE manually for precise control
   - ✅ Works with existing OpenAI client libraries

2. **Alternative Endpoint** (`/chat/stream`):
   - ✅ Uses NestJS's `@Sse` decorator (proper NestJS pattern)
   - ✅ Leverages NestJS built-in SSE handling
   - ✅ More maintainable and follows framework conventions
   - ✅ Better for NestJS-native applications

### Service Methods

The service provides two streaming methods:

- `createStreamingCompletionRaw()`: Returns raw `ChatCompletionStreamResponse` for manual SSE handling
- `createStreamingCompletion()`: Returns `MessageEvent` format for `@Sse` decorator

## System Prompt

The API automatically injects a medical EMR system prompt when no system message is provided:

```
You are a helpful medical assistant AI for a healthcare EMR (Electronic Medical Record) system. You assist healthcare professionals and patients with:

1. Medical information queries (symptoms, conditions, treatments)
2. EMR data analysis and insights
3. Patient care recommendations
4. Administrative healthcare tasks
5. Medical record documentation assistance

Guidelines:
- Always prioritize patient safety and privacy
- Provide accurate, evidence-based medical information
- Clearly state when medical consultation with a healthcare provider is needed
- Be professional, empathetic, and supportive
- Respect HIPAA and medical confidentiality guidelines
- Do not provide specific medical diagnoses - recommend consulting healthcare providers

You have access to various tools to help with EMR data, patient information, and medical workflows.
```

## Tools Integration

The AI agent has access to various tools through the MCP (Model Context Protocol) integration:

- EMR data queries
- Patient lookup
- Medical reference data
- Pharmacy information
- Administrative functions

## Configuration

### Model Configuration

```typescript
// src/ai-chat/constants/models.ts
export const DEFAULT_MODEL = 'gpt-5'; // Always used internally
```

### System Prompt Configuration

```
src/ai-chat/constants/prompt.ts
```

### Environment Variables

- `OPENAI_MODEL`: Default model to use
- `OPENAI_API_URL`: OpenAI API base URL
- `OPENAI_API_KEY`: OpenAI API key

**Note**: The environment `OPENAI_MODEL` is used by the underlying AI service, but the chat API always uses `DEFAULT_MODEL` constant.

## Error Handling

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `500`: Internal Server Error

Error response format:

```json
{
  "error": {
    "message": "Error description",
    "type": "internal_server_error"
  }
}
```

## Logging

The service logs model usage for debugging:

```
[AiChatService] Completion created with ID: chatcmpl-abc123, using internal model: gpt-5, response model: gpt-4o-mini
[AiChatService] Starting streaming completion with ID: chatcmpl-def456, using internal model: gpt-5, response model: gpt-4
```

This helps track that the correct internal model is being used while maintaining API compatibility.

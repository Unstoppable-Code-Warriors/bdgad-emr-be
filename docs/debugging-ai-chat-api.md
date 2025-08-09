# Debugging AI Chat API - Comprehensive Logging Guide

This document explains the enhanced logging added to help debug issues with the AI Chat API, specifically the 404 error you encountered.

## Enhanced Logging Overview

Comprehensive logging has been added throughout the AI Chat service and AI module to help identify where errors occur in the request flow.

## Startup Logging

When the backend starts, you'll now see detailed configuration logging:

### AI Module Configuration

```
[AiModule] 🔧 OpenAI LLM Configuration:
[AiModule]   🎯 Model: gpt-4o-mini
[AiModule]   🌐 Base URL: https://your-custom-api.com/v1
[AiModule]   🔑 API Key: [REDACTED]
[AiModule] 🌐 Using custom OpenAI API URL: https://your-custom-api.com/v1
```

### AI Service Agent Creation

```
[AiService] 🤖 Creating AI agent with LangChain...
[AiService] 🔧 LLM Configuration:
[AiService]   🎯 Model: gpt-4o-mini
[AiService]   📊 Max Tokens: Default
[AiService]   🌡️  Temperature: Default
[AiService]   🔧 LLM instance created - configuration details available in AI module
[AiService] ✅ AI agent created successfully with 12 tools
[AiService] 🧠 Agent model: gpt-4o-mini
```

## Request Flow Logging

When you make a request to `/chat/completions`, you'll see detailed logging at each step:

### 1. Request Reception

```
[AiChatService] 🚀 Starting chat completion request:
[AiChatService] 📋 Request ID: chatcmpl-abc123
[AiChatService] 📝 Request model: gpt-5-mini
[AiChatService] 🎯 Internal model: gpt-4o-mini
[AiChatService] 💬 Messages count: 1
[AiChatService] 🌡️  Temperature: 0.7
[AiChatService] 🔢 Max tokens: 1000
[AiChatService] 📨 Messages preview:
[AiChatService]   1. [user]: What are the symptoms of diabetes?
```

### 2. Agent Preparation

```
[AiChatService] 🤖 Getting AI agent...
[AiChatService] ✅ Successfully obtained AI agent
[AiChatService] 🔄 Converting messages to LangChain format...
[AiChatService] 🔍 Has system message: false
[AiChatService] ➕ Adding system prompt (length: 1024)
[AiChatService] 🎯 Using internal model: gpt-4o-mini for processing
[AiChatService] ✅ Final message count for LangChain: 2
[AiChatService] ✅ Converted 2 messages for LangChain
```

### 3. Final Messages for Agent

```
[AiChatService] 📤 Final messages for agent:
[AiChatService]   1. [system]: You are a helpful medical assistant AI for a healthcare EMR...
[AiChatService]   2. [user]: What are the symptoms of diabetes?
```

### 4. Agent Invocation

```
[AiChatService] 🚀 Invoking AI agent...
[AiChatService] ✅ Agent invocation completed in 2345ms
[AiChatService] 📊 Result structure: ["messages"]
```

### 5. Response Processing

```
[AiChatService] 📝 Extracting response content...
[AiChatService] 📨 Last message type: object
[AiChatService] 📨 Last message keys: ["role","content"]
[AiChatService] 📝 Response content length: 245
[AiChatService] 📝 Response preview: Diabetes symptoms include frequent urination, excessive thirst, unexplained weight loss...
[AiChatService] 🔢 Token usage: prompt=50, completion=61, total=111
```

### 6. Success Completion

```
[AiChatService] ✅ Completion created successfully:
[AiChatService] 📋 Completion ID: chatcmpl-abc123
[AiChatService] ⏱️  Total duration: 2567ms
[AiChatService] 📊 Response model: gpt-5-mini
[AiChatService] 🎯 Internal model used: gpt-4o-mini
```

## Error Logging

When the 404 error occurs, you'll see comprehensive error information:

### Basic Error Information

```
[AiChatService] ❌ Error creating completion after 1234ms:
[AiChatService] 📋 Completion ID: chatcmpl-abc123
[AiChatService] 🚨 Error type: AxiosError
[AiChatService] 🚨 Error message: Request failed with status code 404
[AiChatService] 🚨 Error stack: Error: Request failed...
```

### HTTP Error Details

```
[AiChatService] 🌐 HTTP Status: 404
[AiChatService] 🌐 HTTP Status Text: Not Found
[AiChatService] 🌐 HTTP Headers: {"content-type":"text/html"}
[AiChatService] 🌐 HTTP Data: "<html><head><title>404 Not Found</title></head>..."
```

### Request Configuration Details

```
[AiChatService] 🔧 Request config URL: https://your-api.com/v1/chat/completions
[AiChatService] 🔧 Request config method: POST
[AiChatService] 🔧 Request config headers: {"Authorization":"Bearer sk-...","Content-Type":"application/json"}
```

## Diagnosing Your 404 Error

Based on your error message, here's what to look for in the logs:

### 1. Check OpenAI API URL Configuration

Look for this in the startup logs:

```
[AiModule] 🌐 Base URL: https://your-api-url.com/v1
```

**Common Issues:**

- URL is pointing to nginx server instead of OpenAI API
- URL has wrong path (missing `/v1` or incorrect endpoint)
- URL is not accessible from your server

### 2. Check API Key Configuration

Look for:

```
[AiModule] 🔑 API Key: [REDACTED]
```

If you see:

```
[AiModule] 🔑 API Key: Not configured
[AiModule] ⚠️  OPENAI_API_KEY not configured - this will cause authentication errors
```

### 3. Check Request URL in Error Logs

When the error occurs, look for:

```
[AiChatService] 🔧 Request config URL: https://actual-url-being-called.com/v1/chat/completions
```

This will show exactly what URL the LangChain ChatOpenAI is trying to call.

## Environment Variables to Check

Make sure these environment variables are properly set:

```bash
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional - if using custom API URL
OPENAI_API_URL=https://your-custom-api.com/v1

# Optional - model override (though internal model is always gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
```

## Common 404 Error Causes

1. **Wrong Base URL**:
   - Using `https://api.openai.com` instead of `https://api.openai.com/v1`
   - Using a proxy URL that doesn't support the OpenAI API format

2. **Nginx Proxy Issues**:
   - Your `OPENAI_API_URL` is pointing to an nginx server
   - The nginx server doesn't have proper proxy configuration for OpenAI API

3. **Authentication Issues**:
   - API key is invalid or expired
   - API key doesn't have access to the specified model

4. **Network Issues**:
   - Server can't reach the OpenAI API URL
   - Firewall blocking outbound requests

## Testing Steps

1. **Check Environment Variables**:

   ```bash
   echo $OPENAI_API_KEY
   echo $OPENAI_API_URL
   ```

2. **Test API URL Directly**:

   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "Content-Type: application/json" \
        "$OPENAI_API_URL/models"
   ```

3. **Check Logs During Startup**:
   Look for the configuration logging to ensure values are correct

4. **Make Test Request and Check Logs**:
   Make your curl request and examine the detailed error logging

## Example Log Flow for Your Error

Based on your 404 error, you should see something like:

```
[AiChatService] 🚀 Starting chat completion request:
[AiChatService] 📋 Request ID: chatcmpl-xyz789
[AiChatService] 📝 Request model: gpt-5-mini
[AiChatService] 🎯 Internal model: gpt-4o-mini
...
[AiChatService] 🚀 Invoking AI agent...
[AiChatService] ❌ Error creating completion after 1234ms:
[AiChatService] 🚨 Error message: Request failed with status code 404
[AiChatService] 🔧 Request config URL: https://the-actual-url-being-called.com/v1/chat/completions
```

The `Request config URL` will show you exactly where the request is going, which should help identify the configuration issue.

## Next Steps

1. Start your server with the enhanced logging
2. Check the startup configuration logs
3. Make your test request
4. Examine the detailed error logs
5. Verify the `Request config URL` is correct
6. Check if the URL is reachable and returns the expected OpenAI API response

This comprehensive logging should help pinpoint exactly where the 404 error is occurring in your request flow.

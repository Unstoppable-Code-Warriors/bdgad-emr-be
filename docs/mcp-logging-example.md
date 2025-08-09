# MCP Server and Tools Logging

This document shows the comprehensive logging that occurs when the backend starts up, providing visibility into MCP server connections and available tools.

## Startup Logging Sequence

When the backend starts, you'll see detailed logs about MCP servers and tools in this sequence:

### 1. MCP Client Service Initialization

```
[McpClientService] 🚀 Initializing MCP Client Service...
[McpClientService] 📋 MCP Server Configuration:
[McpClientService]   📡 Server: myServer
[McpClientService]      🔗 Transport: sse
[McpClientService]      🌐 URL: https://ai-search.bdgad.bio/sse
[McpClientService]      🔄 Reconnect: Enabled
[McpClientService]      ⚡ Max Attempts: 5
[McpClientService]      ⏱️  Delay: 2000ms
[McpClientService] 🏷️  Prefix Tool Names: No
[McpClientService] 🏷️  Additional Prefix: "None"
[McpClientService] 🚨 Throw on Load Error: Yes
```

### 2. MCP Server Connection

```
[McpClientService] 🔌 Connecting to MCP servers...
[McpClientService] ✅ Successfully connected to MCP servers
```

### 3. Available Tools Discovery

```
[McpClientService] 🔍 Loading available tools...
[McpClientService] 🛠️  Found 12 tools:
[McpClientService]   1. 🔧 search_patients
[McpClientService]      📝 Search for patients in the EMR database
[McpClientService]   2. 🔧 get_patient_details
[McpClientService]      📝 Get detailed information about a specific patient
[McpClientService]   3. 🔧 search_medications
[McpClientService]      📝 Search for medications and drug information
[McpClientService]   4. 🔧 get_lab_results
[McpClientService]      📝 Retrieve laboratory test results for a patient
[McpClientService]   5. 🔧 schedule_appointment
[McpClientService]      📝 Schedule a new appointment for a patient
[McpClientService]   6. 🔧 get_medical_history
[McpClientService]      📝 Get comprehensive medical history for a patient
[McpClientService]   7. 🔧 search_diagnoses
[McpClientService]      📝 Search for ICD-10 diagnosis codes and descriptions
[McpClientService]   8. 🔧 get_pharmacy_queue
[McpClientService]      📝 Get current pharmacy queue and prescription status
[McpClientService]   9. 🔧 update_patient_record
[McpClientService]      📝 Update patient record with new information
[McpClientService]  10. 🔧 get_billing_info
[McpClientService]      📝 Get billing and insurance information for a patient
[McpClientService]  11. 🔧 search_procedures
[McpClientService]      📝 Search for medical procedures and CPT codes
[McpClientService]  12. 🔧 generate_report
[McpClientService]      📝 Generate medical reports and summaries
```

### 4. AI Service Tool Integration

```
[AiService] 🔧 Loading tools from MCP client...
[AiService] ✅ Successfully loaded 12 tools for AI agent
[AiService] 🛠️  Available tools for AI agent:
[AiService]   1. 🔧 search_patients
[AiService]   2. 🔧 get_patient_details
[AiService]   3. 🔧 search_medications
[AiService]   4. 🔧 get_lab_results
[AiService]   5. 🔧 schedule_appointment
[AiService]   6. 🔧 get_medical_history
[AiService]   7. 🔧 search_diagnoses
[AiService]   8. 🔧 get_pharmacy_queue
[AiService]   9. 🔧 update_patient_record
[AiService]  10. 🔧 get_billing_info
[AiService]  11. 🔧 search_procedures
[AiService]  12. 🔧 generate_report
```

### 5. AI Agent Creation

```
[AiService] 🤖 Creating AI agent with LangChain...
[AiService] ✅ AI agent created successfully with 12 tools
[AiService] 🧠 Agent model: gpt-4o-mini
```

## Different Server Types

### SSE Server Configuration

```
[McpClientService]   📡 Server: sseServer
[McpClientService]      🔗 Transport: sse
[McpClientService]      🌐 URL: https://api.example.com/sse
[McpClientService]      🔄 Reconnect: Enabled
[McpClientService]      ⚡ Max Attempts: 3
[McpClientService]      ⏱️  Delay: 1000ms
```

### Stdio Server Configuration

```
[McpClientService]   📡 Server: stdioServer
[McpClientService]      🔗 Transport: stdio
[McpClientService]      💻 Command: python
[McpClientService]      📝 Args: -m my_mcp_server
```

## Error Scenarios

### Connection Failure

```
[McpClientService] 🔌 Connecting to MCP servers...
[McpClientService] ❌ Failed to connect to MCP servers: Connection timeout
```

### No Tools Available

```
[McpClientService] 🔍 Loading available tools...
[McpClientService] ⚠️  No tools available from MCP servers
[AiService] ⚠️  No tools available for AI agent
```

### No Servers Configured

```
[McpClientService] 📋 MCP Server Configuration:
[McpClientService] ⚠️  No MCP servers configured
```

## Shutdown Logging

When the application shuts down:

```
[McpClientService] 🔥 Shutting down MCP Client Service...
[McpClientService] 🔌 Disconnecting from MCP servers...
[McpClientService] ✅ Disconnected from MCP servers
```

## Runtime Tool Loading

During runtime when tools are requested:

```
[McpClientService] 🔍 Retrieved 12 tools from all servers
[McpClientService] 🔍 Retrieved 5 tools from servers: myServer, otherServer
```

## Health Check Endpoint

You can check MCP server status at runtime using:

**GET** `/health/mcp`

### Success Response

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "success",
  "mcp": {
    "connected": true,
    "serversCount": 1,
    "servers": ["myServer"],
    "toolsCount": 12
  }
}
```

### Error Response

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "error",
  "error": "Connection failed",
  "mcp": {
    "connected": false,
    "servers": []
  }
}
```

## Configuration

### Current MCP Server Configuration

The current configuration in `src/ai/ai.module.ts`:

```typescript
McpClientModule.register({
  throwOnLoadError: true,
  prefixToolNameWithServerName: false,
  additionalToolNamePrefix: '',
  mcpServers: {
    myServer: {
      transport: 'sse',
      url: 'https://ai-search.bdgad.bio/sse',
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 2000,
      },
    },
  },
});
```

## Benefits

This comprehensive logging provides:

1. **🔍 Visibility**: Clear view of what MCP servers are configured and connected
2. **🛠️ Tool Discovery**: Complete list of available tools for troubleshooting
3. **🚨 Error Detection**: Immediate feedback on connection or configuration issues
4. **📊 Status Monitoring**: Runtime health checking capabilities
5. **🔧 Debugging**: Detailed information for development and production debugging

## Log Levels

- **LOG**: General information and success messages
- **WARN**: Non-critical issues (no tools, missing configs)
- **ERROR**: Critical failures (connection errors, tool loading failures)
- **DEBUG**: Detailed information during tool retrieval

## Usage Tips

1. **Startup Monitoring**: Watch the logs during startup to ensure all MCP servers connect successfully
2. **Tool Verification**: Check that the expected tools are loaded and available
3. **Health Monitoring**: Use the `/health/mcp` endpoint in monitoring systems
4. **Troubleshooting**: Review error logs when the AI agent isn't working as expected
5. **Performance**: Monitor tool loading times and connection stability

# 🏥 Pharmacy Queue Service - Updated Quick Start Guide

## Overview

This service simulates emitting RabbitMQ messages to a pharmacy queue with pattern `pharmacy_send`. It now features a simplified API with a single POST endpoint and an automatic hourly cron job.

## ✅ What's Implemented

### 🔧 Service Features

- ✅ RabbitMQ queue emission with pattern `pharmacy_send`
- ✅ Auto-generated mock data based on your commented example
- ✅ Fixed doctor IDs (both use ID `7` as requested)
- ✅ **Single POST endpoint** with smart body detection
- ✅ **Hourly cron job** for automatic queue emission
- ✅ Deep merge of custom data with defaults
- ✅ Comprehensive logging and error handling

### 🎯 API Endpoint (Simplified!)

- ✅ `POST /pharmacy/send-queue` - **Smart endpoint:**
  - **Empty body** → Sends mock data
  - **Body provided** → Sends custom data merged with mock data

### ⏰ Automated Cron Job

- ✅ **Runs every hour** automatically (`0 * * * *`)
- ✅ Sends mock data to the queue
- ✅ Comprehensive logging for monitoring via Console Ninja

### 🧪 Testing Infrastructure

- ✅ Updated unit tests with Jest
- ✅ Demo script for manual testing
- ✅ Mock RabbitMQ client for development

## 🚀 Quick Test Commands

### Using PowerShell (as per your terminal preference)

**Get your JWT token first:**

```powershell
$loginBody = @{
    email = "quydx.work@gmail.com"
    password = "123456aA@"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "https://auth.bdgad.bio/api/v1/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody
$token = $loginResponse.data.token
```

### 1. **Test with empty body (sends mock data):**

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers
```

### 2. **Test with custom data:**

```powershell
$body = @{
    patient = @{
        fullname = "Test Patient Custom"
        phone = "0901234567"
        gender = "Nam"
    }
    appointment = @{
        date = "2025-08-07T15:00:00Z"
    }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers -Body $body
```

### 3. **Test with empty JSON body (also sends mock data):**

```powershell
$emptyBody = @{} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers -Body $emptyBody
```

## 📊 Expected Response Format

Both the API endpoint and cron job return the same format:

```json
{
  "success": true,
  "message": "Message sent to pharmacy queue successfully",
  "pattern": "pharmacy_send",
  "payload": {
    "appointment": {
      "id": "generated-uuid",
      "date": "2025-08-07T08:30:00Z"
    },
    "patient": {
      "fullname": "Nguyễn Thị Mai",
      "ethnicity": "Kinh",
      "marital_status": "Đã kết hôn"
      // ... full patient data
    },
    "medical_record": {
      "incharge_doctor": {
        "id": 7,
        "name": "Nguyễn Văn An"
      },
      "support_doctor": {
        "id": 7,
        "name": "Bác sĩ Nguyễn Thị Dương"
      }
      // ... complete medical record data
    }
  },
  "timestamp": "2025-08-07T08:30:00Z"
}
```

## 🔍 Key Changes Made

### 🆕 Simplified Controller

- **Before**: 3 different endpoints for different scenarios
- **After**: 1 smart endpoint that detects empty vs custom data

### ⏰ Automated Cron Job

- **Frequency**: Every hour (`CronExpression.EVERY_HOUR`)
- **Function**: Automatically sends mock data to queue
- **Monitoring**: Full logging for Console Ninja

### 🎯 Smart Body Detection

```typescript
// Empty body detection logic:
const isEmpty = !body || Object.keys(body).length === 0;

if (isEmpty) {
  // Send mock data
  return await this.pharmacyService.sendToPharmacyQueue();
} else {
  // Send custom data merged with mock data
  return await this.pharmacyService.sendToPharmacyQueue(body);
}
```

## 🔍 Console Ninja Integration

Monitor the service through Console Ninja MCP Server:

- 📡 Queue emission attempts
- ⏰ Cron job executions (every hour)
- 📦 Payload data (in debug mode)
- ✅ Success confirmations
- ❌ Error details with stack traces

## 🧪 Run Tests

```powershell
cd "d:\workspace\project\bdgad\bdgad-emr-be"
npm test -- --testPathPattern=pharmacy
```

## 🎯 Usage Examples

### Scenario 1: Quick Mock Data Test

```powershell
# Just hit the endpoint with no body - gets mock data
Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers
```

### Scenario 2: Custom Patient Name

```powershell
$body = @{ patient = @{ fullname = "Nguyễn Văn Test" } } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers -Body $body
```

### Scenario 3: Custom Appointment Date

```powershell
$body = @{ appointment = @{ date = "2025-12-25T10:00:00Z" } } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:3000/pharmacy/send-queue" -Method POST -Headers $headers -Body $body
```

The service is now **much simpler** while maintaining all the core functionality! 🎉

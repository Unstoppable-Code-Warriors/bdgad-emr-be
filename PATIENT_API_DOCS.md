# Patient API Testing

## Overview

Two new APIs have been implemented for the EMR system:

### 1. GET /patient - Get patients with pagination, search, filters, and sorting

### 2. GET /patient/:id - Get specific patient by ID

Both APIs are protected by authentication and ensure doctors can only access their own patients.

## API Documentation

### GET /patient

**Description**: Get paginated list of patients for the authenticated doctor

**Query Parameters**:

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Number of items per page
- `search` (optional) - Search in patient name or ID
- `gender` (optional) - Filter by gender
- `sortBy` (optional, default: 'FullName') - Sort field (FullName, DateOfBirth, Gender, PatientSourceID)
- `sortOrder` (optional, default: 'ASC') - Sort order (ASC/DESC)

**Example Requests**:

```bash
# Get first page with default settings
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/patient

# Get patients with pagination and search
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:3000/patient?page=1&limit=5&search=Bùi&sortBy=FullName&sortOrder=ASC"

# Filter by gender
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:3000/patient?gender=Male&page=1&limit=10"
```

**Response Format**:

```json
{
  "data": [
    {
      "PatientKey": 1,
      "PatientSourceID": "N4XN95838091OC",
      "FullName": "Hưng Tấn Bùi",
      "DateOfBirth": "1990-01-15",
      "Gender": "Male",
      "Address": "123 Main St",
      "Barcode": "296a7d98-e8e9-4343-a20f-2ca526b32fe4"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### GET /patient/:id

**Description**: Get detailed information about a specific patient

**Path Parameters**:

- `id` - Patient Key (PatientKey)

**Example Request**:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/patient/1
```

**Response Format**:

```json
{
  "PatientKey": 1,
  "PatientSourceID": "N4XN95838091OC",
  "FullName": "Hưng Tấn Bùi",
  "DateOfBirth": "1990-01-15",
  "Gender": "Male",
  "Address": "123 Main St",
  "Barcode": "296a7d98-e8e9-4343-a20f-2ca526b32fe4",
  "recentTests": [
    {
      "TestName": "Genetic Panel Test",
      "DateReceived": "2024-01-15T10:30:00",
      "TestCategory": "Genomics"
    }
  ]
}
```

## Security Features

### Authentication Required

- Both APIs require valid JWT token in Authorization header
- Format: `Authorization: Bearer <your_jwt_token>`

### Doctor-Patient Access Control

- Doctors can only see patients they have performed tests for
- Patient access is filtered by `DimProvider.DoctorId = authenticated_user.id`
- Unauthorized access returns 403 Forbidden
- Non-existent patients return 404 Not Found

### Query Security

- SQL injection protection through parameterized queries
- Input validation on sort fields (whitelist approach)
- Safe type conversion for all user inputs

## Error Responses

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden (trying to access another doctor's patient)

```json
{
  "statusCode": 403,
  "message": "You do not have access to this patient or patient does not exist"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Patient not found"
}
```

## Database Relationships Used

1. **Authentication**: `AuthUser.id` → `DimProvider.DoctorId`
2. **Patient-Doctor**: `DimProvider.ProviderKey` → `FactGeneticTestResult.ProviderKey`
3. **Patient Data**: `FactGeneticTestResult.PatientKey` → `DimPatient.PatientKey`
4. **Test Information**: `FactGeneticTestResult.TestKey` → `DimTest.TestKey`

This ensures that doctors only see patients they have actually worked with in the system.

# Database Schema Designer - REST API Documentation

## API Overview

Base URL: `http://localhost:3000/api/v1`

All API responses follow this structure:
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/login
Authenticate user and get access token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/refresh
Refresh access token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

---

## Schema Management Endpoints

### GET /schemas
Get all schemas for authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term
- `sortBy` (optional): Sort field (name, createdAt, updatedAt)
- `order` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "schemas": [
      {
        "id": "uuid",
        "name": "E-commerce Schema",
        "description": "Online store database design",
        "isPublic": false,
        "version": "1.2.0",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-02T00:00:00.000Z",
        "tablesCount": 8,
        "collaborators": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### GET /schemas/:id
Get specific schema with full details.

**Response:**
```json
{
  "success": true,
  "data": {
    "schema": {
      "id": "uuid",
      "name": "E-commerce Schema",
      "description": "Online store database design",
      "isPublic": false,
      "version": "1.2.0",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "tables": [
        {
          "id": "table_uuid",
          "name": "users",
          "position": {"x": 100, "y": 200},
          "columns": [
            {
              "id": "column_uuid",
              "name": "id",
              "type": "INTEGER",
              "primaryKey": true,
              "required": true,
              "unique": false,
              "defaultValue": null,
              "length": null,
              "precision": null,
              "scale": null
            }
          ]
        }
      ],
      "relationships": [
        {
          "id": "rel_uuid",
          "sourceTableId": "table_uuid_1",
          "sourceColumnId": "column_uuid_1",
          "targetTableId": "table_uuid_2", 
          "targetColumnId": "column_uuid_2",
          "type": "one-to-many",
          "onDelete": "CASCADE",
          "onUpdate": "CASCADE"
        }
      ]
    }
  }
}
```

### POST /schemas
Create a new schema.

**Request:**
```json
{
  "name": "My New Schema",
  "description": "Description of the schema",
  "isPublic": false,
  "templateId": "optional_template_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schema": {
      "id": "uuid",
      "name": "My New Schema",
      "description": "Description of the schema",
      "isPublic": false,
      "version": "1.0.0",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "tables": [],
      "relationships": []
    }
  }
}
```

### PUT /schemas/:id
Update existing schema.

**Request:**
```json
{
  "name": "Updated Schema Name",
  "description": "Updated description",
  "isPublic": true
}
```

### DELETE /schemas/:id
Delete a schema.

**Response:**
```json
{
  "success": true,
  "message": "Schema deleted successfully"
}
```

---

## Table Management Endpoints

### POST /schemas/:schemaId/tables
Create a new table in schema.

**Request:**
```json
{
  "name": "products",
  "position": {"x": 300, "y": 150},
  "description": "Product catalog table"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "table": {
      "id": "table_uuid",
      "name": "products",
      "position": {"x": 300, "y": 150},
      "description": "Product catalog table",
      "columns": [
        {
          "id": "column_uuid",
          "name": "id",
          "type": "INTEGER",
          "primaryKey": true,
          "required": true
        }
      ]
    }
  }
}
```

### PUT /schemas/:schemaId/tables/:tableId
Update table properties.

**Request:**
```json
{
  "name": "updated_table_name",
  "position": {"x": 400, "y": 200},
  "description": "Updated description"
}
```

### DELETE /schemas/:schemaId/tables/:tableId
Delete a table from schema.

---

## Column Management Endpoints

### POST /schemas/:schemaId/tables/:tableId/columns
Add new column to table.

**Request:**
```json
{
  "name": "email",
  "type": "VARCHAR",
  "length": 255,
  "required": true,
  "unique": true,
  "defaultValue": null,
  "description": "User email address"
}
```

### PUT /schemas/:schemaId/tables/:tableId/columns/:columnId
Update column properties.

### DELETE /schemas/:schemaId/tables/:tableId/columns/:columnId
Remove column from table.

---

## Relationship Management Endpoints

### POST /schemas/:schemaId/relationships
Create relationship between tables.

**Request:**
```json
{
  "sourceTableId": "table_uuid_1",
  "sourceColumnId": "column_uuid_1", 
  "targetTableId": "table_uuid_2",
  "targetColumnId": "column_uuid_2",
  "type": "one-to-many",
  "onDelete": "CASCADE",
  "onUpdate": "CASCADE",
  "name": "user_orders"
}
```

### PUT /schemas/:schemaId/relationships/:relationshipId
Update relationship properties.

### DELETE /schemas/:schemaId/relationships/:relationshipId
Remove relationship.

---

## SQL Generation Endpoints

### GET /schemas/:id/sql
Generate SQL DDL for schema.

**Query Parameters:**
- `dialect` (optional): Database dialect (mysql, postgresql, sqlite, mssql)
- `includeDropStatements` (optional): Include DROP statements (default: false)
- `includeComments` (optional): Include comments (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "sql": "CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  email VARCHAR(255) NOT NULL UNIQUE\n);",
    "dialect": "mysql",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /schemas/:id/export
Export schema in various formats.

**Request:**
```json
{
  "format": "sql",
  "dialect": "postgresql",
  "options": {
    "includeData": false,
    "includeComments": true
  }
}
```

---

## Template Endpoints

### GET /templates
Get available schema templates.

**Query Parameters:**
- `category` (optional): Filter by category
- `public` (optional): Show only public templates

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "template_uuid",
        "name": "E-commerce Starter",
        "description": "Basic e-commerce schema with users, products, orders",
        "category": "E-commerce",
        "isPublic": true,
        "usageCount": 1250,
        "rating": 4.8,
        "preview": {
          "tablesCount": 6,
          "relationshipsCount": 8
        }
      }
    ]
  }
}
```

### GET /templates/:id
Get template details.

### POST /templates
Create new template from schema.

**Request:**
```json
{
  "schemaId": "schema_uuid",
  "name": "My Custom Template",
  "description": "Template description",
  "category": "Custom",
  "isPublic": false
}
```

---

## AI Assistant Endpoints

### POST /ai/chat
Send message to AI assistant.

**Request:**
```json
{
  "message": "How should I design a user authentication system?",
  "schemaId": "optional_schema_uuid",
  "context": {
    "currentTable": "users",
    "intent": "schema_design"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "For user authentication, I recommend...",
    "suggestions": [
      {
        "type": "create_table",
        "title": "Create users table",
        "description": "Add a users table with authentication fields"
      }
    ]
  }
}
```

### POST /ai/analyze
Analyze schema for improvements.

**Request:**
```json
{
  "schemaId": "schema_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "score": 85,
      "issues": [
        {
          "type": "performance",
          "severity": "medium",
          "message": "Consider adding index on frequently queried column",
          "table": "users",
          "column": "email"
        }
      ],
      "recommendations": [
        "Add foreign key constraints",
        "Consider data normalization",
        "Add audit timestamps"
      ]
    }
  }
}
```

---

## Collaboration Endpoints

### GET /schemas/:id/collaborators
Get schema collaborators.

### POST /schemas/:id/collaborators
Invite user to collaborate.

**Request:**
```json
{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

### PUT /schemas/:id/collaborators/:userId
Update collaborator permissions.

### DELETE /schemas/:id/collaborators/:userId
Remove collaborator.

---

## Real-time WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

#### Join Schema Room
```javascript
socket.emit('join_schema', { schemaId: 'uuid' });
```

#### Schema Updates
```javascript
// Listen for real-time updates
socket.on('schema_updated', (data) => {
  // Handle schema changes
});

// Send updates
socket.emit('update_schema', {
  schemaId: 'uuid',
  changes: {
    type: 'table_moved',
    tableId: 'table_uuid',
    position: { x: 100, y: 200 }
  }
});
```

#### User Presence
```javascript
socket.on('user_joined', (user) => {
  // Show user joined
});

socket.on('user_left', (user) => {
  // Show user left
});

socket.on('cursor_moved', (data) => {
  // Update cursor position
});
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Invalid credentials |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_SERVER_ERROR` | Server error |
| `SCHEMA_LIMIT_EXCEEDED` | User has reached schema limit |
| `INVALID_SQL_DIALECT` | Unsupported SQL dialect |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Authentication | 5 requests/minute |
| General API | 100 requests/minute |
| AI Assistant | 20 requests/minute |
| File Upload | 10 requests/minute |

---

## Data Types Supported

### MySQL
- INTEGER, BIGINT, SMALLINT, TINYINT
- VARCHAR(n), CHAR(n), TEXT, LONGTEXT
- DECIMAL(p,s), FLOAT, DOUBLE
- DATE, TIME, DATETIME, TIMESTAMP
- BOOLEAN, BIT
- JSON, BLOB, LONGBLOB

### PostgreSQL
- INTEGER, BIGINT, SMALLINT
- VARCHAR(n), CHAR(n), TEXT
- DECIMAL(p,s), NUMERIC(p,s), REAL, DOUBLE PRECISION
- DATE, TIME, TIMESTAMP, TIMESTAMPTZ
- BOOLEAN
- JSON, JSONB, UUID, ARRAY

### SQLite
- INTEGER, REAL, TEXT, BLOB
- NUMERIC, DECIMAL(p,s)
- DATE, DATETIME

### SQL Server
- INT, BIGINT, SMALLINT, TINYINT
- VARCHAR(n), CHAR(n), NVARCHAR(n), TEXT, NTEXT
- DECIMAL(p,s), NUMERIC(p,s), FLOAT, REAL, MONEY
- DATE, TIME, DATETIME, DATETIME2, SMALLDATETIME
- BIT, UNIQUEIDENTIFIER
- IMAGE, VARBINARY, XML

---

This API provides comprehensive CRUD operations for all schema components with real-time collaboration, AI integration, and multi-database support.
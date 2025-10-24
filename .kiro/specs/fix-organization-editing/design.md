# Design Document

## Overview

This design addresses the organization editing functionality by simplifying the interface and API to work with the current database schema. The solution removes slug dependencies and focuses on core name editing functionality.

## Architecture

### Frontend Architecture
- **Admin Organizations Page**: Simplified table view without slug columns
- **Edit Dialog**: Single input field for organization name
- **Form Validation**: Client-side validation for required name field
- **Error Handling**: Toast notifications for success/error states

### Backend Architecture
- **PUT API Endpoint**: `/api/organizations/[orgId]` - Updates only the name field
- **Input Validation**: Server-side validation for required fields
- **Database Operations**: Direct update to organizations table using existing columns
- **Error Response**: Structured error responses with appropriate HTTP codes

## Components and Interfaces

### Frontend Components

#### OrganizationsPage Component
```typescript
interface Organization {
  id: string
  name: string
  created_at: string
  memberships: { count: number }[]
}

interface FormData {
  name: string
}
```

**Key Changes:**
- Remove `slug` from Organization interface
- Remove slug column from table display
- Remove slug input from edit dialog
- Simplify form validation to name-only

#### Edit Dialog
- Single input field for organization name
- Automatic form validation
- Clear success/error messaging
- Simplified form state management

### Backend Interfaces

#### API Request/Response
```typescript
// PUT Request Body
interface UpdateOrganizationRequest {
  name: string
}

// API Response
interface UpdateOrganizationResponse {
  success: boolean
  organization: Organization
  message: string
}

// Error Response
interface ErrorResponse {
  error: string
}
```

## Data Models

### Database Operations
- **Table**: `organizations`
- **Updated Fields**: `name` only
- **Query**: `UPDATE organizations SET name = $1 WHERE id = $2`

### Validation Rules
- **Name**: Required, non-empty string
- **Permissions**: Super admin or organization admin only
- **Authentication**: Valid user session required

## Error Handling

### Frontend Error Handling
1. **Network Errors**: Display "Connection failed" message
2. **Validation Errors**: Show field-specific error messages
3. **Permission Errors**: Display "Access denied" message
4. **Server Errors**: Show server-provided error message

### Backend Error Handling
1. **Authentication Errors**: Return 401 Unauthorized
2. **Permission Errors**: Return 403 Forbidden
3. **Validation Errors**: Return 400 Bad Request with details
4. **Database Errors**: Return 500 Internal Server Error with safe message
5. **Not Found Errors**: Return 404 Not Found

### Error Response Format
```typescript
{
  error: string,           // User-friendly error message
  details?: string,        // Optional technical details
  code?: string           // Optional error code
}
```

## Testing Strategy

### Frontend Testing
- **Component Rendering**: Verify table displays correctly without slug columns
- **Form Validation**: Test name field validation
- **User Interactions**: Test edit dialog open/close/submit flows
- **Error States**: Test error message display

### Backend Testing
- **API Endpoints**: Test PUT /api/organizations/[orgId] with various inputs
- **Authentication**: Test with valid/invalid user sessions
- **Authorization**: Test with different user roles
- **Validation**: Test with empty/invalid organization names
- **Database Operations**: Test successful updates and error scenarios

### Integration Testing
- **End-to-End Flow**: Test complete edit organization workflow
- **Error Scenarios**: Test network failures and server errors
- **Permission Scenarios**: Test with different user roles

## Implementation Notes

### Database Compatibility
- Solution works with current database schema
- No new columns required
- Future slug functionality can be added without breaking changes

### Performance Considerations
- Minimal database queries (single UPDATE statement)
- Efficient frontend re-rendering after updates
- Proper loading states during API calls

### Security Considerations
- Server-side permission validation
- Input sanitization and validation
- Proper error message handling (no sensitive data exposure)

### Future Extensibility
- Design allows for easy addition of slug functionality
- Component structure supports additional organization fields
- API can be extended without breaking existing functionality
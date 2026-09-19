# ICE Mortgage Technology Encompass API Guide

> **DISCLAIMER**: This is educational guidance based on publicly documented APIs. Always verify against official ICE Developer Connect documentation. Never use production credentials in development. This does not constitute official ICE documentation.

## Overview

ICE Encompass is the leading loan origination system in the U.S. mortgage industry. The Encompass Developer Connect platform provides REST APIs for integrating with Encompass.

## Authentication

### OAuth 2.0 (Recommended)
- **Grant Types**: Client Credentials, Authorization Code
- **Token Endpoint**: `https://api.elliemae.com/oauth2/v1/token`
- **Scopes**: `lp` (Loan Pipeline), various feature-specific scopes

```
POST /oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={client_id}
&client_secret={client_secret}
&scope=lp
```

### API Key Authentication (Legacy)
- Some endpoints support `x-api-key` header
- Being deprecated in favor of OAuth

### Instance ID
- Required header: `X-Ellie-Mae-Instance-Id`
- Identifies the Encompass instance
- Obtained during partner onboarding

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.elliemae.com` |
| Sandbox | `https://api.elliemae.com` (with sandbox instance ID) |

## Core API Families

### Loan APIs
Primary resource for loan data CRUD operations.

**Endpoints:**
- `GET /encompass/v3/loans/{loanId}` - Get loan
- `POST /encompass/v3/loans` - Create loan
- `PATCH /encompass/v3/loans/{loanId}` - Update loan fields
- `DELETE /encompass/v3/loans/{loanId}` - Delete loan

**Loan Data Model:**
- Uses field IDs (e.g., `4000` for Loan Amount, `1109` for Property Address)
- Hierarchical structure with sections (Borrower, Property, Loan Terms, etc.)
- Custom fields supported

### Pipeline APIs
For searching and filtering loans.

**Endpoints:**
- `POST /encompass/v3/loanPipeline` - Search pipeline
- Query by loan status, date ranges, assigned users, custom criteria

**Example Pipeline Query:**
```json
{
  "filter": {
    "terms": [
      {"canonicalName": "Loan.LoanFolder", "value": "My Pipeline"},
      {"canonicalName": "Loan.LoanStatus", "value": "Active"}
    ]
  },
  "fields": ["Loan.LoanNumber", "Loan.BorrowerName", "Loan.LoanAmount"]
}
```

### Document APIs
For managing loan documents.

**Endpoints:**
- `GET /encompass/v3/loans/{loanId}/documents` - List documents
- `POST /encompass/v3/loans/{loanId}/documents` - Upload document
- `GET /encompass/v3/loans/{loanId}/attachments/{attachmentId}` - Download

### eFolder APIs
For eFolder management and document tracking.

### Users and Organizations
- `GET /encompass/v3/users` - List users
- `GET /encompass/v3/organizations` - Organization structure

### Contacts
- `GET /encompass/v3/borrowers` - Borrower contacts
- `GET /encompass/v3/businessContacts` - Business contacts

## Webhooks

Encompass supports webhooks for event-driven integrations.

**Subscription Endpoints:**
- `POST /webhook/v1/subscriptions` - Create subscription
- `GET /webhook/v1/subscriptions` - List subscriptions
- `DELETE /webhook/v1/subscriptions/{id}` - Delete subscription

**Common Events:**
- `Loan.Created`
- `Loan.Updated`
- `Loan.StatusChanged`
- `Document.Added`
- `Milestone.Completed`

**Webhook Payload:**
```json
{
  "eventId": "...",
  "eventType": "Loan.Updated",
  "eventTime": "2024-01-15T10:30:00Z",
  "meta": {
    "resourceType": "Loan",
    "resourceId": "{loanGuid}",
    "instanceId": "{instanceId}"
  }
}
```

## Rate Limits

| Tier | Requests/Min | Requests/Day |
|------|--------------|--------------|
| Standard | 600 | 50,000 |
| High Volume | Negotiated | Negotiated |

**Rate Limit Headers:**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Safe Integration Steps

1. **Register as Developer**
   - Apply at developer.elliemae.com
   - Complete partner agreement
   - Obtain sandbox credentials

2. **Sandbox Development**
   - Use sandbox instance ID
   - Test all CRUD operations
   - Validate webhook handling

3. **Security Review**
   - ICE may require security assessment
   - Document data handling practices
   - Implement proper token storage

4. **Production Onboarding**
   - Obtain production credentials
   - Configure production instance ID
   - Implement proper error handling

5. **Monitoring**
   - Log all API calls (without secrets)
   - Monitor rate limits
   - Set up alerting for failures

## Common Integration Patterns

### Loan Import
1. Create loan shell via POST
2. Update fields via PATCH
3. Upload documents via attachments API
4. Trigger workflows via milestones

### Loan Export
1. Query pipeline for target loans
2. Fetch full loan data
3. Download required documents
4. Transform to target format

### Real-Time Sync
1. Subscribe to webhooks
2. Process events asynchronously
3. Fetch updated data on change
4. Handle deduplication

## Error Handling

**Common Error Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (token expired)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (invalid loan/resource)
- `429` - Rate Limited
- `500` - Server Error

**Error Response Format:**
```json
{
  "errorCode": "VALIDATION_ERROR",
  "errorMessage": "Field 4000 is required",
  "details": [...]
}
```

## SDK and Tools

- **Encompass SDK (.NET)** - Official SDK for .NET
- **Encompass SDK (Java)** - Community SDK
- **Postman Collection** - Available from developer portal
- **OpenAPI Spec** - Available for most endpoints

## Resources

- Developer Portal: developer.elliemae.com
- API Reference: developer.elliemae.com/apis
- Community Forum: developer.elliemae.com/community
- Status Page: status.elliemae.com

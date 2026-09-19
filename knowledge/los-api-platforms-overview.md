# LOS Platform APIs Overview

> **DISCLAIMER**: This is educational guidance based on publicly available information. Always verify against official vendor documentation. API access typically requires partner agreements.

## Major LOS Platforms

### Byte Software (BytePro Enterprise)

**Overview:**
- Mid-market LOS
- Cloud and on-premise options
- Strong in credit union space

**API Capabilities:**
- REST API available
- OAuth 2.0 authentication
- Loan CRUD operations
- Pipeline access
- Document management

**Integration Approach:**
- Partner registration required
- Sandbox environment available
- MISMO support

**Auth Pattern:**
```
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "{id}",
  "client_secret": "{secret}"
}
```

---

### LendingPad

**Overview:**
- Cloud-native LOS
- Modern architecture
- Focus on digital mortgage

**API Capabilities:**
- RESTful APIs
- GraphQL options
- Webhook support
- Real-time events

**Key Features:**
- Open API approach
- Well-documented endpoints
- Developer-friendly
- Modern auth (OAuth 2.0, API keys)

**Integration Resources:**
- Developer portal available
- API documentation published
- Sandbox access

---

### MortgageBot (Finastra/Black Knight)

**Overview:**
- Enterprise LOS
- Part of Finastra/Black Knight ecosystem
- Strong compliance features

**API Capabilities:**
- SOAP and REST APIs
- Integration hub
- Partner ecosystem
- Webhook/event support

**Auth Pattern:**
- OAuth 2.0
- Certificate-based options
- IP whitelisting common

---

### OpenClose

**Overview:**
- Cloud LOS platform
- Digital mortgage focus
- POS integration strong

**API Features:**
- REST APIs
- Modern architecture
- POS-to-LOS bridge
- Third-party integrations

**Integration:**
- Partner program
- API documentation
- Sandbox testing

---

### Arive (formerly Calyx Path competitor)

**Overview:**
- Modern cloud LOS
- Workflow automation
- Mobile-first design

**API Capabilities:**
- REST API
- Webhook events
- Real-time sync
- Document APIs

---

### LoanDepot-Style Stacks

**Retail Lender Patterns:**
- Custom-built or heavily customized LOS
- Mix of vendor + proprietary
- Limited external API access
- Internal microservices architecture

**Common Components:**
- POS layer (Blend, Floify, custom)
- LOS core (Encompass, custom)
- Pricing engine
- Document management
- Compliance layer

---

## POS-to-LOS Bridges

### Blend

**Overview:**
- Leading digital lending platform
- POS + workflow
- LOS integrations

**API Features:**
- REST APIs
- Webhook events
- OAuth 2.0
- Well-documented

**LOS Integrations:**
- Encompass (deep integration)
- BytePro
- Others via API

**Auth Pattern:**
```
Authorization: Bearer {access_token}
X-Blend-Client-Id: {client_id}
```

**Common Endpoints:**
- `/api/v1/applications` - Loan applications
- `/api/v1/borrowers` - Borrower data
- `/api/v1/documents` - Document handling

---

### Floify

**Overview:**
- POS/1003 collection
- Document collection
- LOS sync

**API Capabilities:**
- REST API
- Webhook events
- LOS connectors
- OAuth 2.0

**Integration Pattern:**
- Collect application via Floify
- Push to LOS via API
- Sync status back

---

### SimpleNexus

**Overview:**
- Mobile-first POS
- LO productivity tools
- LOS integrations

**API Features:**
- REST APIs
- Mobile SDK
- Webhook support

---

### Roostify

**Overview:**
- Digital mortgage platform
- Borrower portal
- LOS integrations

**API Capabilities:**
- REST APIs
- Event-driven architecture
- SSO support

---

## Common Integration Patterns

### Loan Application Flow
```
Borrower → POS (Blend/Floify) → LOS (Encompass)
                    ↓
              Credit Pull
                    ↓
              Pricing Engine
                    ↓
              Disclosures
```

### Document Flow
```
Borrower Upload → POS → LOS eFolder
        ↓
    OCR/Index
        ↓
    Stacking Order
        ↓
    Underwriting Review
```

### Status Sync
```
LOS Status Change → Webhook → POS Update → Borrower Notification
```

---

## Authentication Patterns Across Platforms

### OAuth 2.0 (Most Common)
- Client Credentials flow for server-to-server
- Authorization Code flow for user context
- Token refresh support

### API Key
- Simpler but less secure
- Often used with IP whitelisting
- Being phased out by many vendors

### Certificate-Based
- Mutual TLS (mTLS)
- Used by enterprise/banking
- Higher security, more complex setup

### SAML/SSO
- For user-facing integrations
- Single sign-on scenarios
- Often combined with API auth

---

## Data Models

### MISMO Standards
- Industry standard for mortgage data
- Version 2.x (legacy), 3.x (current)
- XML schema-based
- Field mappings available

### Vendor-Specific
- Each LOS has proprietary field model
- Mapping to MISMO available
- Custom fields supported

### Common Entities
- Loan/Application
- Borrower(s)
- Property
- Loan Terms
- Documents/Attachments
- Milestones/Workflow
- Users/Roles

---

## Rate Limits (Typical)

| Pattern | Requests/Minute | Requests/Day |
|---------|-----------------|--------------|
| Standard | 100-600 | 10K-50K |
| High Volume | Negotiated | Negotiated |
| Burst | 2x standard | N/A |

---

## Safe Integration Practices

1. **Partner Agreement** - Always sign vendor agreement
2. **Sandbox First** - Never test on production data
3. **Credential Security** - Use secrets management
4. **Rate Limiting** - Implement backoff
5. **Error Handling** - Log and alert on failures
6. **Monitoring** - Track API health
7. **Audit Logging** - Record all operations
8. **Data Privacy** - Handle PII appropriately

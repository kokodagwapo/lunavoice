# ICE Mortgage Technology Empower API Guide

> **DISCLAIMER**: This is educational guidance based on publicly available information. Always verify against official ICE documentation. Never use production credentials in development.

## Overview

ICE Empower (formerly Ellie Mae Empower) is a loan origination system designed for smaller lenders and credit unions. It's cloud-native and offers simpler integration compared to Encompass.

## Authentication

### OAuth 2.0
- Similar pattern to Encompass
- Token endpoint shared with ICE platform
- Instance-based authentication

```
POST /oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={client_id}
&client_secret={client_secret}
```

### Required Headers
- `Authorization: Bearer {access_token}`
- `X-Ellie-Mae-Instance-Id: {instance_id}`

## API Families

### Loan Management
- Create, read, update loans
- Field-based data model (similar to Encompass field IDs)
- Loan workflow management

### Document Management
- Upload/download attachments
- eFolder integration
- Document indexing

### Pipeline
- Loan search and filtering
- Pipeline views
- Reporting queries

### User Management
- User provisioning
- Role assignment
- Organization structure

## Key Differences from Encompass

| Feature | Empower | Encompass |
|---------|---------|-----------|
| Target Market | Small-mid lenders | Enterprise |
| Hosting | Cloud-only | Cloud or on-prem |
| Customization | Limited | Extensive |
| API Complexity | Simpler | More comprehensive |
| Pricing | Per-loan | Enterprise license |

## Integration Approach

1. **Contact ICE Sales** for Empower API access
2. **Sandbox Environment** provided for development
3. **Simpler onboarding** vs Encompass
4. **Shared developer portal** at developer.elliemae.com

## Safe Integration Steps

1. Register with ICE Developer Connect
2. Obtain Empower-specific instance credentials
3. Test in sandbox environment
4. Validate data mapping with Empower field model
5. Production deployment with monitoring

## Resources

- Developer Portal: developer.elliemae.com
- Empower Product Page: icemortgagetechnology.com/empower
- Support: ICE customer support channels

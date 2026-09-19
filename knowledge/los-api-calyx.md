# Calyx Point / Calyx APIs Guide

> **DISCLAIMER**: This is educational guidance based on publicly available information. Always verify against official Calyx documentation. Note: "Calix" is a different company (telecommunications/broadband); this covers Calyx Software (mortgage LOS).

## Overview

Calyx Software provides loan origination solutions including:
- **Calyx Point** - Desktop LOS for mortgage brokers/lenders
- **Calyx Path** - Cloud-based LOS
- **PointCentral** - Centralized Point data management

## Calyx Point

### Architecture
- Windows desktop application
- Local or network database
- File-based loan storage (.pts files)

### Integration Options

#### 1. Point XSLT Integration
- Import/export via XML transformation
- Calyx provides schema documentation
- Supports MISMO formats

#### 2. Point SDK (COM-based)
- Windows COM API
- Direct field access
- Automation capabilities

```
' VB Example
Dim ptApp As PointApplication
Set ptApp = CreateObject("Point.Application")
ptApp.OpenLoan "C:\Loans\loan.pts"
ptApp.SetField "BORR_FNAME", "John"
```

#### 3. Database Access (PointCentral)
- SQL Server database
- Read access for reporting
- Limited write (risky without SDK)

### Field Model
- Proprietary field codes
- Maps to MISMO 2.x/3.x
- Custom field support

### Common Integration Patterns

**Loan Import:**
1. Generate MISMO XML
2. Transform via XSLT
3. Import into Point

**Loan Export:**
1. Export from Point as XML
2. Transform to target format
3. Process downstream

**Real-Time Sync:**
- Limited webhook support
- Polling-based approach common
- PointCentral enables better sync

## Calyx Path

### Cloud-Native LOS
- REST API available
- Modern authentication (OAuth 2.0)
- Better integration capabilities than Point

### API Authentication
- OAuth 2.0 flows
- API key options
- Partner-specific credentials

### API Families
- Loan CRUD operations
- Document management
- Pipeline and reporting
- User management

## PointCentral

### Centralized Management
- Multiple Point installations
- Shared database
- Better API surface

### Database Schema
- SQL Server based
- Documented for partners
- Read-only recommended without SDK

## Calyx Integration Services

Calyx offers integration services:
- **CalyxPath Connect** - POS integration
- **Pricing integrations** - PPE connections
- **Credit/VOE** - Verification services
- **Compliance** - TRID compliance tools

## Safe Integration Steps

### For Calyx Point
1. Obtain Calyx partner agreement
2. Request SDK/documentation
3. Use test loan files
4. Validate field mappings
5. Test with Point installed

### For Calyx Path
1. Register as integration partner
2. Obtain API credentials
3. Use sandbox environment
4. Build and test integration
5. Security review
6. Production deployment

## Calix Note

**Calix, Inc.** is an entirely different company:
- Telecommunications/broadband equipment
- Cloud and software platforms for service providers
- Not related to mortgage/lending

If the user mentions "Calix" in a banking context, they may mean:
- Calyx (mortgage LOS) - covered here
- A core banking system (research specific product)

## Resources

- Calyx Software: calyxsoftware.com
- Partner inquiries: Contact Calyx directly
- Training: Calyx University (for customers)

## Rate Limits

Rate limits vary by:
- Partner tier
- API endpoint
- License type

Consult Calyx documentation for specific limits.

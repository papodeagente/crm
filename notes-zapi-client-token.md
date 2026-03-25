# Z-API Client-Token Issue — Analysis

## Problem
The Z-API account has "Account Security Token" feature ENABLED.
When enabled, ALL API calls to ALL instances must include the correct `Client-Token` header.

## Errors Observed
- Without Client-Token: `{"error":"your client-token is not configured"}` (HTTP 400)
- With Partner Token as Client-Token: `{"error":"Client-Token ... not allowed"}` (HTTP 403)
- The Partner Token (JWT) is NOT the same as the Account Security Token

## Root Cause
The Account Security Token is a separate token generated in the Z-API admin panel (Security tab).
It's different from:
- Instance Token (returned when creating instance)
- Partner Token (JWT used for Partner API calls)

## Current Code Issue
In `zapiProvisioningService.ts` line 211 and 235:
```
zapiClientToken: PARTNER_TOKEN(),
providerClientToken: PARTNER_TOKEN(),
```
This stores the Partner Token as the Client-Token, which is WRONG.

## Solution
The ZAPI_PARTNER_TOKEN env var is the Partner API token (JWT for creating/managing instances).
The Client-Token for instance API calls is a SEPARATE token from the Z-API account Security tab.

Options:
1. Add a new env var ZAPI_CLIENT_TOKEN for the account security token
2. The user needs to provide this token from Z-API admin panel → Security tab
3. Or disable the Client-Token security feature in Z-API admin panel

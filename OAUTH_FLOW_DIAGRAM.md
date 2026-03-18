# Google OAuth Flow - Visual Diagram

## Complete OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE OAUTH FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: INITIATE OAUTH
═══════════════════════════════════════════════════════════════════════════════

User clicks "Connect Google Ads"
         ↓
    /dashboard/google
         ↓
    Select Client
         ↓
    Click "Iniciar Conexão"
         ↓
    GET /api/google/oauth/initiate?clientId=<UUID>
         ↓
    ┌─────────────────────────────────────────┐
    │ Validate:                               │
    │ ✓ User authenticated                    │
    │ ✓ Client exists                         │
    │ ✓ User has access to client             │
    └─────────────────────────────────────────┘
         ↓
    Generate state = crypto.randomUUID()
         ↓
    Save to database:
    oauth_states {
      state: <UUID>,
      client_id: <UUID>,
      user_id: <UUID>,
      provider: 'google',
      expires_at: now + 10 minutes
    }
         ↓
    Generate Google OAuth URL
         ↓
    Redirect to Google Consent Screen
         ↓


STEP 2: GOOGLE OAUTH CONSENT
═══════════════════════════════════════════════════════════════════════════════

User sees Google consent screen
         ↓
    User grants permissions
         ↓
    Google redirects to:
    /api/google/callback?code=<AUTH_CODE>&state=<STATE>
         ↓


STEP 3: PROCESS CALLBACK
═══════════════════════════════════════════════════════════════════════════════

GET /api/google/callback?code=<CODE>&state=<STATE>
         ↓
    ┌─────────────────────────────────────────┐
    │ Validate:                               │
    │ ✓ State exists in database              │
    │ ✓ State not expired                     │
    │ ✓ Client exists                         │
    │ ✓ User has access to client             │
    └─────────────────────────────────────────┘
         ↓
    Exchange code for tokens:
    POST https://oauth2.googleapis.com/token
         ↓
    Receive:
    {
      access_token: <TOKEN>,
      refresh_token: <TOKEN>,
      expires_in: 3600
    }
         ↓
    Create connection in database:
    google_ads_connections {
      client_id: <UUID>,
      access_token: <TOKEN>,
      refresh_token: <TOKEN>,
      token_expires_at: now + 1 hour,
      customer_id: 'pending',  ← NOT YET SELECTED
      status: 'active'
    }
         ↓
    Delete state from database
         ↓
    Set cookies:
    ┌─────────────────────────────────────────┐
    │ google_connectionId = <CONNECTION_ID>   │
    │ google_clientId = <CLIENT_ID>           │
    │ maxAge: 10 minutes                      │
    │ httpOnly: false (JS can access)         │
    │ sameSite: lax (CSRF protection)         │
    └─────────────────────────────────────────┘
         ↓
    Redirect to:
    /google/select-accounts?connectionId=<ID>&clientId=<ID>
         ↓


STEP 4: SELECT ACCOUNTS (FIXED!)
═══════════════════════════════════════════════════════════════════════════════

Page loads: /google/select-accounts?connectionId=<ID>&clientId=<ID>
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │ PARAMETER LOADING (PRIORITY ORDER)                          │
    │                                                             │
    │ 1. Check URL Parameters                                    │
    │    ✓ connectionId = <ID>                                   │
    │    ✓ clientId = <ID>                                       │
    │    → FOUND! Use these                                      │
    │    → Save to sessionStorage                                │
    │                                                             │
    │ 2. If not in URL, check Cookies                            │
    │    ✓ google_connectionId = <ID>                            │
    │    ✓ google_clientId = <ID>                                │
    │    → FOUND! Use these                                      │
    │                                                             │
    │ 3. If not in cookies, check sessionStorage                 │
    │    ✓ google_connectionId = <ID>                            │
    │    ✓ google_clientId = <ID>                                │
    │    → FOUND! Use these                                      │
    │                                                             │
    │ 4. If not in sessionStorage, check localStorage            │
    │    ✓ google_connectionId_backup = <ID>                     │
    │    ✓ google_clientId_backup = <ID>                         │
    │    → FOUND! Use these                                      │
    │                                                             │
    │ 5. If NOTHING found → ERROR                                │
    │    "Fluxo OAuth não iniciado corretamente"                 │
    └─────────────────────────────────────────────────────────────┘
         ↓
    Validate parameters:
    ✓ Not null/undefined
    ✓ Not string 'null'
    ✓ Valid UUID format
         ↓
    Fetch available accounts:
    GET /api/google/accounts-direct?connectionId=<ID>&clientId=<ID>
         ↓
    ┌─────────────────────────────────────────┐
    │ API Response:                           │
    │ {                                       │
    │   accounts: [                           │
    │     {                                   │
    │       customerId: "1234567890",         │
    │       descriptiveName: "My Account",    │
    │       currencyCode: "USD",              │
    │       timeZone: "America/New_York",     │
    │       canManageClients: false           │
    │     },                                  │
    │     ...                                 │
    │   ]                                     │
    │ }                                       │
    └─────────────────────────────────────────┘
         ↓
    Display accounts list
         ↓
    User selects accounts
         ↓
    Click "Conectar X conta(s)"
         ↓


STEP 5: SAVE SELECTION
═══════════════════════════════════════════════════════════════════════════════

POST /api/google/accounts/select-simple
{
  connectionId: <ID>,
  clientId: <ID>,
  selectedAccounts: ["1234567890", "0987654321"]
}
         ↓
    Update connection in database:
    google_ads_connections {
      customer_id: "1234567890",  ← NOW SET!
      status: 'active'
    }
         ↓
    Redirect to:
    /dashboard/google?success=connected&accounts=2
         ↓
    ✅ SUCCESS!
         ↓


PARAMETER LOADING FLOW (DETAILED)
═══════════════════════════════════════════════════════════════════════════════

Browser receives redirect:
/google/select-accounts?connectionId=abc123&clientId=def456

         ↓

useEffect hook runs:
┌─────────────────────────────────────────────────────────────┐
│ const urlConnectionId = searchParams.get('connectionId')    │
│ const urlClientId = searchParams.get('clientId')            │
│                                                             │
│ if (urlConnectionId && urlClientId) {                       │
│   ✅ FOUND IN URL                                           │
│   finalConnectionId = urlConnectionId                       │
│   finalClientId = urlClientId                              │
│   sessionStorage.setItem(...)  // Save for later            │
│ } else {                                                    │
│   ⚠️ NOT IN URL, TRY FALLBACKS                              │
│                                                             │
│   // Try cookies                                           │
│   const cookies = parseCookies()                           │
│   if (cookies.google_connectionId) {                       │
│     ✅ FOUND IN COOKIES                                    │
│     finalConnectionId = cookies.google_connectionId        │
│     finalClientId = cookies.google_clientId                │
│   }                                                        │
│                                                             │
│   // Try sessionStorage                                    │
│   if (!finalConnectionId) {                                │
│     const stored = sessionStorage.getItem(...)             │
│     if (stored) {                                          │
│       ✅ FOUND IN SESSION STORAGE                          │
│       finalConnectionId = stored                           │
│     }                                                      │
│   }                                                        │
│                                                             │
│   // Try localStorage                                      │
│   if (!finalConnectionId) {                                │
│     const backup = localStorage.getItem(...)               │
│     if (backup) {                                          │
│       ✅ FOUND IN LOCAL STORAGE                            │
│       finalConnectionId = backup                           │
│     }                                                      │
│   }                                                        │
│ }                                                          │
│                                                             │
│ if (finalConnectionId && finalClientId) {                  │
│   setConnectionId(finalConnectionId)                       │
│   setClientId(finalClientId)                               │
│   setParamsLoaded(true)                                    │
│ } else {                                                   │
│   ❌ ERROR: No parameters found                            │
│   setError('Fluxo OAuth não iniciado corretamente')        │
│ }                                                          │
└─────────────────────────────────────────────────────────────┘

         ↓

Second useEffect runs (when paramsLoaded = true):
┌─────────────────────────────────────────────────────────────┐
│ Validate parameters:                                        │
│ ✓ connectionId is not null/undefined                        │
│ ✓ clientId is not null/undefined                            │
│ ✓ Both are valid UUIDs                                      │
│                                                             │
│ If valid:                                                   │
│   fetchAvailableAccounts()                                  │
│                                                             │
│ If invalid:                                                │
│   setError('Parâmetros de conexão inválidos')              │
└─────────────────────────────────────────────────────────────┘

         ↓

✅ ACCOUNTS LOADED AND DISPLAYED


BEFORE vs AFTER
═══════════════════════════════════════════════════════════════════════════════

BEFORE (BROKEN):
┌─────────────────────────────────────────────────────────────┐
│ Multiple separate if blocks                                 │
│ Could fail silently                                         │
│ No clear priority                                           │
│ Hard to debug                                               │
│ Result: Parameters always null                              │
└─────────────────────────────────────────────────────────────┘

AFTER (FIXED):
┌─────────────────────────────────────────────────────────────┐
│ Single unified logic                                        │
│ Clear priority order                                        │
│ Explicit logging at each step                               │
│ Easy to debug                                               │
│ Result: Parameters loaded from URL or fallback              │
└─────────────────────────────────────────────────────────────┘

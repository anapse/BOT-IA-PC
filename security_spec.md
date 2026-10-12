# Security Specification for Bot IA PC

## 1. Data Invariants
- An agent must have a unique ID.
- A Telegram connection must be associated with a valid agent ID.
- Access to configurations is restricted to authenticated administrators.
- PII (not applicable here, but kept in mind) is isolated if added.
- Timestamps (`createdAt`) are immutable after creation.

## 2. The "Dirty Dozen" Payloads (Examples)
1. { "name": "HackAgent", "createdAt": "2026-10-11T23:34:00Z", "secretKey": "bad" } - Shadow field injection.
2. { "name": "", "createdAt": "2026-10-11T23:34:00Z" } - Empty name.
3. { "name": "Agent", "createdAt": "invalid-date" } - Invalid timestamp format.
4. ... (other payloads would test ID poisoning, type mismatch, etc.)

## 3. Test Runner (Conceptual)
`firestore.rules.test.ts` will verify these payloads return PERMISSION_DENIED.

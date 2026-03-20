# Inbox Instant Update — Diagnostic

## Current Architecture (Problems)

1. **conversationsQ** uses `refetchInterval: 10000` (10s polling) — this is the main source of delay
2. **Socket handler** (line 1176-1357) does optimistic cache update via `trpcUtils.whatsapp.waConversations.setData` — this is GOOD but:
   - It calls `conversationsQ.refetch()` for new conversations (line 1229)
   - It calls `queueStatsQ.refetch()` on every message (line 1262)
3. **dedupedConvs** (line 1431-1453) re-sorts the ENTIRE array on every render via `useMemo`
4. **filteredConvs** (line 1456-1481) re-filters on every render
5. The cache update at line 1255 does a FULL SORT after each message update

## Root Causes of Delay

1. **refetchInterval: 10000** — conversations refetch every 10s, overwriting optimistic updates
2. **Full array sort** in both the socket handler AND dedupedConvs memo — O(n log n) on every message
3. **queueStatsQ.refetch()** on every message — unnecessary network call
4. **staleTime: 5000** — allows stale data to persist for 5s

## Solution: Deterministic Client State

### Key Changes:
1. Remove `refetchInterval` from conversationsQ (socket is source of truth)
2. Replace full sort with `moveToTop` operation (O(n) splice + unshift)
3. Use `useRef` for conversationMap to avoid re-renders on intermediate updates
4. Batch updates: preview + timestamp + unread + position in single state update
5. Only do initial fetch on mount, then socket drives all updates

### Implementation Plan:
- Create `useConversationStore` hook with Map + sorted IDs
- Socket handler updates map entry + moves to top
- Render reads from sorted IDs → map lookup
- No refetch, no polling, no full sort

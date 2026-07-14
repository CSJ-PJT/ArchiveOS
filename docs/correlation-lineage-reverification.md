# Cross-service correlation re-verification

ArchiveOS does not merge different correlation IDs from `orderId`, `entityId`, or time proximity. A complete lineage is valid only when the same `correlationId` is preserved by Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger, and ArchiveOS.

## Preconditions

- All Archive services are running and emitting synthetic runtime events.
- A single synthetic order flow has completed through the service contract without external writes from ArchiveOS.

## SQL verification

```sql
select correlation_id,
       count(*) as event_count,
       count(distinct source_system_id) as service_count,
       array_agg(distinct source_system_id order by source_system_id) as services,
       count(distinct event_id) as distinct_event_ids,
       min(occurred_at) as first_event_at,
       max(occurred_at) as last_event_at
from ecosystem_flow_event
where correlation_id = :correlation_id
group by correlation_id;
```

Use the resulting ID with:

```http
GET /api/correlation-timeline/{correlationId}
```

Verify event order, `latencyFromPrevious`, duplicate event IDs, and the expected Market → Nexus → Logistics → Ledger → ArchiveOS lineage. Until all five services are present, the UI must remain `PARTIAL_CHAIN` / `INCOMPLETE_LINEAGE`.

## UI procedure

1. Select a correlationId in Dashboard recent events.
2. Confirm navigation to Records Timeline.
3. Check the connected-service count, first/last service, missing expected stages, event table, and anomaly list.
4. Do not mark the chain complete solely from entity IDs or similar timestamps.

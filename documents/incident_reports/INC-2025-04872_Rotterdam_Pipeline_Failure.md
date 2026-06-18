# INCIDENT REPORT
## INC-2025-04872: Rotterdam DC WMS-to-SAP Synchronization Failure

| | |
|---|---|
| **Incident ID** | INC-2025-04872 |
| **Severity** | P2 -- High |
| **Status** | Resolved (Post-Mortem Complete) |
| **Opened** | 2025-09-28 14:22 UTC |
| **Detected** | 2025-09-28 11:15 UTC (by supply chain analyst, not by monitoring) |
| **Actual Failure Start** | **2025-09-24 02:14 UTC** |
| **Time to Detect** | **4 days, 9 hours** |
| **Resolved** | 2025-10-01 16:45 UTC |
| **Reported By** | Pieter van Dijk, Supply Chain Analyst, EU Region |
| **Assigned To** | IT Integration Team (lead: Raj Patel) |
| **Affected System** | WMS-SAP integration batch job (JOB-RTD-INV-SYNC-001) |
| **Affected Location** | DC-RTD-01 (Rotterdam, Netherlands) |

---

## 1. Incident Summary

The nightly batch synchronization job (JOB-RTD-INV-SYNC-001) responsible for replicating inventory adjustment transactions from Oracle WMS at DC-RTD-01 to SAP S/4HANA failed silently on September 24, 2025 at 02:14 UTC. The job hung during a database connection timeout and entered a suspended state without generating an error or alert. Inventory adjustments (cycle count corrections, damage write-offs, and transfer confirmations) made in the WMS after September 24 were not reflected in SAP.

The failure went undetected for **4 days and 9 hours** until a supply chain analyst noticed that the Rotterdam inventory report "looked off" during routine analysis.

## 2. Timeline

| Date/Time (UTC) | Event |
|---|---|
| 2025-09-24 02:14 | Batch job JOB-RTD-INV-SYNC-001 initiates nightly run |
| 2025-09-24 02:14 | Job attempts database connection to Oracle WMS |
| 2025-09-24 02:14 | Connection timeout (Oracle WMS undergoing unscheduled maintenance by DBA team -- no change ticket filed) |
| 2025-09-24 02:14 | Job enters SUSPENDED state. **No error logged. No alert generated.** |
| 2025-09-24 02:15 | Job scheduler marks job as "IN PROGRESS" (never updated to FAILED) |
| 2025-09-25 02:14 | Scheduler attempts to start next nightly run. Finds previous run still "IN PROGRESS." Skips. **No alert.** |
| 2025-09-26 02:14 | Same behavior. Job skipped again. |
| 2025-09-27 02:14 | Same behavior. Job skipped again. |
| 2025-09-28 11:15 | Pieter van Dijk notices inventory numbers in the Rotterdam weekly report don't match expectations. Begins manual investigation. |
| 2025-09-28 14:22 | Pieter files INC-2025-04872 after confirming SAP quantities for 42 SKUs diverge significantly from WMS. |
| 2025-09-28 15:00 | IT Integration Team begins investigation. Discovers suspended job. |
| 2025-09-28 16:30 | Root cause identified: WMS DB connection timeout during unplanned maintenance. |
| 2025-09-29 08:00 | Backfill planning begins. 4 days of adjustment transactions must be replayed from WMS to SAP. |
| 2025-09-30 14:00 | Backfill script developed and tested in QA environment. |
| 2025-10-01 02:00 | Backfill executed in production. |
| 2025-10-01 08:00 | Verification: SAP and WMS quantities reconciled for all 42 affected SKUs. |
| 2025-10-01 16:45 | Incident closed. |

## 3. Impact

| Impact Area | Detail |
|---|---|
| **SKUs affected** | 42 SKUs at DC-RTD-01 |
| **Inventory discrepancy** | SAP overstated inventory by 847 units total across all affected SKUs |
| **Largest single discrepancy** | SKU MCG-4420 (Bluetooth Speaker): SAP showed 500 units, WMS showed 312, physical count: 287 |
| **Out-of-stock events caused** | 7 stores in the Netherlands and Germany experienced out-of-stock on 3 of the affected SKUs. Replenishment was not triggered because SAP believed stock was available at the DC. |
| **Estimated lost revenue** | ~$34,000 (lost sales from 7 stores over 4 days) |
| **Estimated inventory write-off** | $12,800 (cycle count adjustments that were delayed) |
| **Downstream data impact** | Demand planning models (Blue Yonder) ingested incorrect SAP inventory data for 4 days, potentially affecting forecasts for the next 2-4 weeks |

## 4. Root Cause Analysis

### Primary Root Cause
The batch job scheduler does not distinguish between "running normally" and "hung/suspended." When the job's database connection timed out, it entered a SUSPENDED state but the scheduler still showed it as IN PROGRESS. Subsequent scheduled runs were skipped because the scheduler saw the previous run as still active.

### Contributing Factors

1. **No monitoring on job completion**: There is no check that validates "did the job complete successfully?" Only error states are monitored, and a SUSPENDED state is not classified as an error.

2. **No data freshness monitoring**: No system checks whether the SAP inventory snapshot for Rotterdam is current. If someone had monitored "when was the last successful sync for DC-RTD-01?", the failure would have been detected within hours, not days.

3. **Unplanned WMS maintenance**: The DBA team performed unscheduled maintenance on the Oracle WMS database at 02:00 UTC without filing a change ticket or notifying the integration team. This caused the connection timeout.

4. **No redundancy**: The batch job has no retry logic. A single connection timeout causes a permanent hang.

## 5. Corrective Actions

| # | Action | Owner | Target Date | Status |
|---|---|---|---|---|
| 1 | Add job completion monitoring: alert if JOB-RTD-INV-SYNC-001 does not reach COMPLETED status within 2 hours of start | Raj Patel | 2025-10-15 | COMPLETED |
| 2 | Add data freshness monitoring: alert if MAX(snapshot_timestamp) for any DC is > 4 hours old | Raj Patel | 2025-10-30 | COMPLETED |
| 3 | Add retry logic to batch job: 3 retries with 5-minute backoff on connection timeout | Raj Patel | 2025-11-15 | COMPLETED |
| 4 | Require change tickets for ALL database maintenance windows | DBA Team Lead | 2025-10-15 | COMPLETED |
| 5 | **Replace nightly batch with real-time CDC** (Project Qlarity -- Qlik Talend Cloud) | Priya Ramanathan | 2026-Q2 | IN PROGRESS |
| 6 | Implement pipeline health dashboard with SLA tracking (Qlik Analytics) | Data Engineering | 2026-Q2 | IN PROGRESS |

## 6. Lessons Learned

1. **Monitoring the absence of data is as important as monitoring the presence of errors.** The job didn't fail -- it just stopped producing data. Our monitoring only looks for errors, not for missing data.

2. **A human noticed the problem, not a system.** Pieter noticed the numbers "looked off" during routine analysis. If Pieter had been on vacation, the failure could have gone undetected for weeks.

3. **Silent failures are the most dangerous kind.** The system showed green across the board. No errors, no alerts, no warnings. Just quietly stale data.

4. **Batch is fragile. Real-time CDC is the answer.** The Project Qlarity initiative to replace batch synchronization with Qlik Talend Cloud CDC will eliminate this entire class of failure.

---
*Meridian Commerce Group -- IT Incident Management -- CONFIDENTIAL*

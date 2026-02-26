# STANDARD OPERATING PROCEDURE
## SOP-CS-001: "Where Is My Order?" (WISMO) Call Handling Procedure

| | |
|---|---|
| **Document ID** | SOP-CS-001 |
| **Version** | 2.3 |
| **Effective Date** | 2025-08-01 |
| **Owner** | Maria Santos, VP Customer Experience |
| **Classification** | Internal -- Customer Service Teams |

---

## 1. Purpose

Defines the standard procedure for handling customer inquiries about order delivery status. WISMO calls currently represent **41% of all customer service contacts**, costing **$2.30 per call** in agent time. Total annual WISMO cost estimated at **$14.8M**.

## 2. Current Challenge

Customer service agents must check **5 separate systems** to answer a single WISMO question:

| System | What It Shows | Access Method |
|---|---|---|
| Salesforce Commerce Cloud | Order details, promised delivery date | Web portal (Tab 1) |
| Salesforce CRM | Customer profile, previous interactions | Web portal (Tab 2) |
| Descartes TMS | Carrier assignment, tracking number | Separate application (Tab 3) |
| Carrier tracking portal | Current shipment status | Carrier-specific websites (Tab 4) |
| Oracle WMS / Manhattan WMS | Fulfillment status (picked, packed, shipped) | VPN + terminal emulator (Tab 5) |

Average handle time for a WISMO call: **8.5 minutes** (target: 4 minutes).

**NOTE**: Project CLARITY (Qlik platform, target Q2 2026) will provide a unified order tracking view via Qlik Answers, enabling agents to ask natural language questions about order status. Until then, follow the manual procedure below.

## 3. Procedure

### Step 1: Identify the Order (1 minute)

1. Greet the customer per MCG greeting script
2. Ask for order number OR email address associated with the order
3. Look up in Salesforce Commerce Cloud
4. Confirm: order date, items ordered, shipping address

### Step 2: Check Fulfillment Status (2 minutes)

1. Check Salesforce Commerce Cloud order status field:
   - `PROCESSING` → Order received, not yet fulfilled. Check WMS for pick status.
   - `SHIPPED` → Carrier has the package. Proceed to Step 3.
   - `DELIVERED` → System shows delivered. Ask customer to check with household members, building reception, safe place. If still not found, proceed to Step 4.
   - `DELIVERY_FAILED` → Carrier attempted delivery and failed. Proceed to Step 4.

2. If status is `PROCESSING` and order is > 2 business days old:
   - Check WMS (Oracle for Americas/EU, Manhattan for APAC) for pick/pack status
   - **KNOWN ISSUE**: WMS status may not reflect in Salesforce for up to 30 minutes due to sync delay. If WMS shows SHIPPED but Salesforce shows PROCESSING, advise customer the order is on its way and status will update shortly.

### Step 3: Check Carrier Tracking (3 minutes)

1. Find the tracking number in Descartes TMS (match by order number)
2. **If no tracking number**: 42% of orders (especially APAC and Africa regions) do not have tracking numbers due to carrier limitations. Inform the customer: "Your order is being delivered by a local carrier that does not provide online tracking. Based on the estimated delivery window, your order should arrive by [date]."
3. **If tracking number exists**: Open the carrier's tracking portal:

| Carrier | Portal | Notes |
|---|---|---|
| FedEx | fedex.com/tracking | Reliable, real-time updates |
| DHL Express | dhl.com/tracking | Reliable, real-time updates |
| DPD | dpd.de/tracking | Status may be in German. Use Chrome translate. |
| NinjaVan | ninjavan.co/tracking | Updates every 15 minutes |
| Correios | rastreamento.correios.com.br | Status in Portuguese. **Updates may be 24-48 hours delayed.** |
| Royal Mail | royalmail.com/track | Reliable |
| Local couriers (Lagos, Jakarta, etc.) | No portal | Contact carrier directly via phone |

4. Relay the current status to the customer in plain language:
   - "Your package is currently in transit and is expected to arrive by [date]."
   - "Your package is out for delivery today."
   - "There was a delivery attempt on [date] but it was unsuccessful because [reason]. The carrier will reattempt delivery on [next attempt date]."

### Step 4: Escalation Paths (2 minutes)

| Scenario | Action |
|---|---|
| Package shows DELIVERED but customer hasn't received it | Create case in CRM, initiate carrier investigation (SLA: 48-hour response from carrier) |
| Package delayed > 5 days past promised date | Offer options: wait, reship, or refund. Supervisor approval for refund > $100. |
| Address correction needed | Contact carrier for intercept/redirect if still in transit. If delivered to wrong address, initiate carrier investigation. |
| BOPIS order not ready at store | Contact store directly. If inventory discrepancy, check WMS for actual stock. |
| No tracking, no status updates, customer frustrated | Apologize sincerely. Offer $10 MCG credit as goodwill. Create escalation case. |

## 4. Scripting Examples

**Opening:**
> "Thank you for calling Meridian Commerce. My name is [Agent Name]. I'd be happy to help you check on your order. May I have your order number or the email address associated with your order?"

**When tracking shows in transit:**
> "I can see that your package is currently in transit with [Carrier]. It's expected to arrive by [date]. Would you like me to send you the tracking link by email so you can monitor it directly?"

**When no tracking available:**
> "Your order is being delivered by a regional carrier in [country]. While real-time tracking isn't available for this delivery service, based on the shipping date and estimated transit time, your order should arrive by [date]. I apologize for the limited visibility."

**When delivery is late:**
> "I can see that your order was expected by [date] and hasn't arrived yet. I sincerely apologize for the delay. Let me check with the carrier for an update. [Check carrier status.] Based on what I'm seeing, [provide update]. Would you like me to [offer next steps]?"

## 5. Metrics

| Metric | Target | Current (Q3 2025) |
|---|---|---|
| WISMO as % of total contacts | < 25% | **41%** |
| Average handle time (WISMO) | < 4 min | **8.5 min** |
| First-contact resolution rate | > 80% | 62% |
| Customer satisfaction (WISMO) | > 4.0/5.0 | 3.1/5.0 |
| Cost per WISMO contact | < $1.50 | **$2.30** |

## 6. Future State (Project CLARITY)

The Qlik platform implementation will introduce:
- **Qlik Answers**: Agents can ask "What is the status of order WEB-2025-10-0094827?" in natural language and receive a unified answer drawing from all 5 systems simultaneously.
- **Unified tracking dashboard** (Qlik Sense): Single-screen view of order journey from placement to delivery.
- **Proactive outreach**: Discovery Agent will detect delayed shipments and trigger automated customer notifications BEFORE the customer calls.

Expected impact: WISMO call volume reduction of **55%**, handle time reduction to **3 minutes**, customer satisfaction improvement to **4.2/5.0**.

---
*Meridian Commerce Group -- Customer Service Operations*

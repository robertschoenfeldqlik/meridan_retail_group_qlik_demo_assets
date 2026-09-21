#!/usr/bin/env python3
"""One-shot Salesforce org setup for the MCG simulator.

Creates the two MCG custom objects and their fields via the Metadata API, then
grants field-level security. BOTH steps are required: fields created through the
Metadata API carry no FLS -- not even for System Administrator -- so without the
second pass the REST API reports every custom field as "No such column".

Idempotent: existing objects/fields are skipped, so it is safe to re-run.
Mirrors the spec printed by `salesforce_simulator.py --setup-help`.
"""
import os, sys
from simple_salesforce import Salesforce

sf = Salesforce(username=os.environ["SF_USERNAME"], password=os.environ["SF_PASSWORD"],
                security_token=os.environ.get("SF_SECURITY_TOKEN", ""),
                domain=os.environ.get("SF_DOMAIN", "login"), version="61.0")
md = sf.mdapi
print("connected:", sf.sf_instance)

def existing_objects():
    return {s["name"] for s in sf.describe()["sobjects"]}

def existing_fields(obj):
    try:
        return {f["name"] for f in getattr(sf, obj).describe()["fields"]}
    except Exception:
        return set()

def text(fullname, label, length, unique=False, ext=False):
    kw = dict(fullName=fullname, label=label, type=md.FieldType("Text"), length=length)
    if unique: kw["unique"] = True
    if ext: kw["externalId"] = True
    return md.CustomField(**kw)

def picklist(fullname, label, values):
    return md.CustomField(
        fullName=fullname, label=label, type=md.FieldType("Picklist"),
        valueSet=md.ValueSet(valueSetDefinition=md.ValueSetValuesDefinition(
            sorted=False,
            value=[md.CustomValue(fullName=v, default=False, label=v) for v in values])))

OBJECTS = {
    "MCG_Order__c": dict(label="MCG Order", plural="MCG Orders", nameLabel="Order Name"),
    "MCG_Product__c": dict(label="MCG Product", plural="MCG Products", nameLabel="Product Name"),
}

FIELDS = {
    "MCG_Order__c": [
        lambda: text("MCG_Order__c.Order_ID__c", "Order ID", 30, unique=True, ext=True),
        lambda: md.CustomField(fullName="MCG_Order__c.Contact__c", label="Contact",
                               type=md.FieldType("Lookup"), referenceTo="Contact",
                               relationshipLabel="MCG Orders", relationshipName="MCG_Orders"),
        lambda: md.CustomField(fullName="MCG_Order__c.Order_Date__c", label="Order Date", type=md.FieldType("DateTime")),
        lambda: text("MCG_Order__c.SKU__c", "SKU", 30),
        lambda: text("MCG_Order__c.Product_Name__c", "Product Name", 100),
        lambda: picklist("MCG_Order__c.Fulfillment_Method__c", "Fulfillment Method",
                         ["SHIP_TO_HOME", "BOPIS", "CURBSIDE"]),
        lambda: md.CustomField(fullName="MCG_Order__c.Promised_Delivery__c", label="Promised Delivery", type=md.FieldType("Date")),
        lambda: md.CustomField(fullName="MCG_Order__c.Actual_Delivery__c", label="Actual Delivery", type=md.FieldType("Date")),
        lambda: text("MCG_Order__c.Carrier__c", "Carrier", 20),
        lambda: text("MCG_Order__c.Tracking_Number__c", "Tracking Number", 40),
        lambda: picklist("MCG_Order__c.Order_Status__c", "Order Status",
                         ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "DELIVERY_FAILED"]),
        lambda: md.CustomField(fullName="MCG_Order__c.WISMO_Flag__c", label="WISMO Flag",
                               type=md.FieldType("Checkbox"), defaultValue="false"),
    ],
    "MCG_Product__c": [
        lambda: text("MCG_Product__c.SKU__c", "SKU", 40, unique=True, ext=True),
        lambda: text("MCG_Product__c.Legacy_SKU_Americas__c", "Legacy SKU Americas", 30),
        lambda: text("MCG_Product__c.Legacy_SKU_EU__c", "Legacy SKU EU", 30),
        lambda: text("MCG_Product__c.Product_Name__c", "Product Name", 100),
        lambda: text("MCG_Product__c.Category_L1__c", "Category L1", 30),
        lambda: text("MCG_Product__c.Category_L2__c", "Category L2", 30),
        lambda: text("MCG_Product__c.Category_L3__c", "Category L3", 30),
        lambda: md.CustomField(fullName="MCG_Product__c.Weight_KG__c", label="Weight KG",
                               type=md.FieldType("Number"), precision=8, scale=2),
        lambda: text("MCG_Product__c.Country_of_Origin__c", "Country of Origin", 5),
        lambda: text("MCG_Product__c.Supplier_Name__c", "Supplier Name", 80),
    ],
}

have = existing_objects()
for obj, meta in OBJECTS.items():
    if obj in have:
        print(f"  object {obj}: already exists")
        continue
    print(f"  creating object {obj} ...", end=" ")
    md.CustomObject.create(md.CustomObject(
        fullName=obj, label=meta["label"], pluralLabel=meta["plural"],
        nameField=md.CustomField(label=meta["nameLabel"], type=md.FieldType("Text")),
        deploymentStatus=md.DeploymentStatus("Deployed"),
        sharingModel=md.SharingModel("ReadWrite")))
    print("OK")

for obj, builders in FIELDS.items():
    present = existing_fields(obj)
    made, skipped, failed = 0, 0, 0
    for b in builders:
        f = b()
        short = f.fullName.split(".", 1)[1]
        if short in present:
            skipped += 1
            continue
        try:
            md.CustomField.create(f)
            made += 1
        except Exception as e:
            failed += 1
            print(f"    FAIL {short}: {type(e).__name__} {str(e)[:130]}")
    print(f"  {obj}: {made} created, {skipped} already present, {failed} failed")


# ---------------------------------------------------------------------------
# Field-level security
# ---------------------------------------------------------------------------


OBJECTS = ["MCG_Order__c", "MCG_Product__c"]

print("\n--- fields visible to this user right now ---")
for o in OBJECTS:
    names = [f["name"] for f in getattr(sf, o).describe()["fields"]]
    print(f"  {o}: {len(names)} visible -> {', '.join(names)}")

print("\n--- fields that actually exist (Tooling API) ---")
existing = {}
for o in OBJECTS:
    q = sf.toolingexecute(
        "query/?q=" + ("SELECT QualifiedApiName FROM FieldDefinition "
                       f"WHERE EntityDefinition.QualifiedApiName='{o}' AND QualifiedApiName LIKE '%__c'").replace(" ", "+"))
    existing[o] = [r["QualifiedApiName"] for r in q.get("records", [])]
    print(f"  {o}: {len(existing[o])} custom fields -> {', '.join(existing[o])}")

PS_NAME = "MCG_Simulator_Access"
res = sf.query(f"SELECT Id FROM PermissionSet WHERE Name = '{PS_NAME}'")
if res["totalSize"]:
    ps_id = res["records"][0]["Id"]
    print(f"\npermission set exists: {ps_id}")
else:
    ps_id = sf.PermissionSet.create({"Name": PS_NAME, "Label": "MCG Simulator Access"})["id"]
    print(f"\ncreated permission set: {ps_id}")

print("\n--- granting field permissions ---")
granted = skipped = failed = 0
for o in OBJECTS:
    for fname in existing[o]:
        full = f"{o}.{fname}"
        chk = sf.query(f"SELECT Id FROM FieldPermissions WHERE ParentId='{ps_id}' AND Field='{full}'")
        if chk["totalSize"]:
            skipped += 1
            continue
        try:
            sf.FieldPermissions.create({
                "ParentId": ps_id, "SobjectType": o, "Field": full,
                "PermissionsRead": True, "PermissionsEdit": True})
            granted += 1
        except Exception as e:
            failed += 1
            print(f"    FAIL {full}: {str(e)[:110]}")
print(f"  {granted} granted, {skipped} already set, {failed} failed")

me = sf.query(f"SELECT Id FROM User WHERE Username = '{os.environ['SF_USERNAME']}'")["records"][0]["Id"]
asg = sf.query(f"SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId='{ps_id}' AND AssigneeId='{me}'")
if asg["totalSize"]:
    print("assignment already in place")
else:
    sf.PermissionSetAssignment.create({"AssigneeId": me, "PermissionSetId": ps_id})
    print("permission set assigned to user")

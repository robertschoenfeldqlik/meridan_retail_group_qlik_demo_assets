#!/usr/bin/env python3
"""
create_topics.py — Create MCG Kafka topics on any Kafka cluster
================================================================
Standalone script for users who have their own Kafka cluster
(Confluent Cloud, Amazon MSK, self-managed) and don't need
the Docker Compose stack.

Creates:
  - mcg.iot.cold-chain     (3 partitions, 7-day retention)
  - mcg.iot.carrier-events (3 partitions, 30-day retention)

Usage:
  pip install confluent-kafka
  python create_topics.py --bootstrap-servers localhost:9092

  # For Confluent Cloud:
  python create_topics.py \
    --bootstrap-servers pkc-xxxxx.us-east-1.aws.confluent.cloud:9092 \
    --security-protocol SASL_SSL \
    --sasl-mechanism PLAIN \
    --sasl-username YOUR_API_KEY \
    --sasl-password YOUR_API_SECRET

  # For Amazon MSK with IAM:
  python create_topics.py \
    --bootstrap-servers b-1.msk-cluster.xxxxx.kafka.us-east-1.amazonaws.com:9098 \
    --security-protocol SASL_SSL \
    --sasl-mechanism OAUTHBEARER

  # List existing topics (no creation):
  python create_topics.py --bootstrap-servers localhost:9092 --list-only

  # Delete topics (cleanup):
  python create_topics.py --bootstrap-servers localhost:9092 --delete
"""

import argparse
import sys
import time

try:
    from confluent_kafka.admin import (
        AdminClient,
        NewTopic,
        ConfigResource,
        ResourceType,
    )
except ImportError:
    print("ERROR: confluent-kafka package is required.")
    print("Install with:  pip install confluent-kafka")
    sys.exit(1)


# ---------------------------------------------------------------------------
#  MCG Topic Definitions
# ---------------------------------------------------------------------------

MCG_TOPICS = [
    {
        "name": "mcg.iot.cold-chain",
        "partitions": 3,
        "replication_factor": 1,
        "config": {
            "retention.ms": "604800000",       # 7 days
            "cleanup.policy": "delete",
            "compression.type": "lz4",
        },
        "description": "Cold chain IoT sensor readings (~1 msg/5s per sensor)",
    },
    {
        "name": "mcg.iot.carrier-events",
        "partitions": 3,
        "replication_factor": 1,
        "config": {
            "retention.ms": "2592000000",      # 30 days
            "cleanup.policy": "delete",
            "compression.type": "lz4",
        },
        "description": "Carrier status update events (~1 msg/min)",
    },
]


# ---------------------------------------------------------------------------
#  Admin Operations
# ---------------------------------------------------------------------------

def build_admin_config(args):
    """Build AdminClient config dict from CLI args."""
    config = {
        "bootstrap.servers": args.bootstrap_servers,
        "client.id": "mcg-topic-admin",
    }

    if args.security_protocol and args.security_protocol != "PLAINTEXT":
        config["security.protocol"] = args.security_protocol

    if args.sasl_mechanism:
        config["sasl.mechanisms"] = args.sasl_mechanism

    if args.sasl_username:
        config["sasl.username"] = args.sasl_username

    if args.sasl_password:
        config["sasl.password"] = args.sasl_password

    return config


def list_topics(admin):
    """List all topics on the cluster."""
    metadata = admin.list_topics(timeout=10)
    topics = sorted(metadata.topics.keys())

    print(f"\n{'Topic':<40} {'Partitions':<12} {'Replicas'}")
    print("-" * 65)

    mcg_found = 0
    for topic_name in topics:
        if topic_name.startswith("_"):
            continue  # skip internal topics
        topic = metadata.topics[topic_name]
        parts = len(topic.partitions)
        replicas = len(list(topic.partitions.values())[0].replicas) if topic.partitions else 0
        marker = " ← MCG" if topic_name.startswith("mcg.") else ""
        print(f"  {topic_name:<38} {parts:<12} {replicas}{marker}")
        if topic_name.startswith("mcg."):
            mcg_found += 1

    print(f"\nTotal: {len([t for t in topics if not t.startswith('_')])} topics "
          f"({mcg_found} MCG topics)")
    return mcg_found


def create_topics(admin, args):
    """Create MCG topics."""
    # Check which topics already exist
    metadata = admin.list_topics(timeout=10)
    existing = set(metadata.topics.keys())

    new_topics = []
    for topic_def in MCG_TOPICS:
        if topic_def["name"] in existing:
            print(f"  ✓ {topic_def['name']} — already exists")
            continue

        rf = topic_def["replication_factor"]
        if args.replication_factor:
            rf = args.replication_factor

        new_topic = NewTopic(
            topic_def["name"],
            num_partitions=topic_def["partitions"],
            replication_factor=rf,
            config=topic_def["config"],
        )
        new_topics.append((topic_def, new_topic))

    if not new_topics:
        print("\n  All MCG topics already exist. Nothing to do.")
        return True

    print(f"\n  Creating {len(new_topics)} topic(s)...")
    futures = admin.create_topics([nt for _, nt in new_topics])

    success = True
    for topic_def, _ in new_topics:
        topic_name = topic_def["name"]
        try:
            futures[topic_name].result()  # blocks until done
            print(f"  ✓ {topic_name} — created "
                  f"(partitions={topic_def['partitions']}, "
                  f"retention={int(topic_def['config']['retention.ms'])//86400000}d)")
            print(f"    {topic_def['description']}")
        except Exception as e:
            print(f"  ✗ {topic_name} — FAILED: {e}")
            success = False

    return success


def delete_topics(admin):
    """Delete MCG topics (cleanup)."""
    metadata = admin.list_topics(timeout=10)
    existing = set(metadata.topics.keys())

    to_delete = [t["name"] for t in MCG_TOPICS if t["name"] in existing]

    if not to_delete:
        print("\n  No MCG topics found to delete.")
        return True

    print(f"\n  Deleting {len(to_delete)} topic(s)...")
    confirm = input("  Are you sure? This will delete all messages. [y/N]: ").strip().lower()
    if confirm not in ("y", "yes"):
        print("  Cancelled.")
        return True

    futures = admin.delete_topics(to_delete)
    success = True
    for topic_name, future in futures.items():
        try:
            future.result()
            print(f"  ✓ {topic_name} — deleted")
        except Exception as e:
            print(f"  ✗ {topic_name} — FAILED: {e}")
            success = False

    return success


# ---------------------------------------------------------------------------
#  CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Create MCG Kafka topics on any Kafka cluster.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Local Docker Compose:
  python create_topics.py --bootstrap-servers localhost:9092

  # Confluent Cloud:
  python create_topics.py \\
    --bootstrap-servers pkc-xxxxx.confluent.cloud:9092 \\
    --security-protocol SASL_SSL \\
    --sasl-mechanism PLAIN \\
    --sasl-username API_KEY \\
    --sasl-password API_SECRET

  # List topics:
  python create_topics.py --bootstrap-servers localhost:9092 --list-only

  # Delete MCG topics:
  python create_topics.py --bootstrap-servers localhost:9092 --delete
        """,
    )

    parser.add_argument("--bootstrap-servers", required=True,
                        help="Kafka bootstrap servers (host:port)")
    parser.add_argument("--security-protocol", default="PLAINTEXT",
                        choices=["PLAINTEXT", "SASL_PLAINTEXT", "SASL_SSL", "SSL"],
                        help="Security protocol (default: PLAINTEXT)")
    parser.add_argument("--sasl-mechanism", default=None,
                        help="SASL mechanism (PLAIN, SCRAM-SHA-256, OAUTHBEARER)")
    parser.add_argument("--sasl-username", default=None,
                        help="SASL username / API key")
    parser.add_argument("--sasl-password", default=None,
                        help="SASL password / API secret")
    parser.add_argument("--replication-factor", type=int, default=None,
                        help="Override replication factor (default: 1 for single-node, 3 for production)")
    parser.add_argument("--list-only", action="store_true",
                        help="List existing topics without creating any")
    parser.add_argument("--delete", action="store_true",
                        help="Delete MCG topics (cleanup)")

    args = parser.parse_args()

    print("=" * 60)
    print("  MCG Kafka Topic Manager")
    print("=" * 60)
    print(f"  Broker: {args.bootstrap_servers}")
    print(f"  Security: {args.security_protocol}")

    # Connect
    try:
        config = build_admin_config(args)
        admin = AdminClient(config)

        # Quick connectivity check
        metadata = admin.list_topics(timeout=10)
        broker_count = len(metadata.brokers)
        print(f"  Connected to {broker_count} broker(s)")
    except Exception as e:
        print(f"\n  ERROR: Cannot connect to Kafka broker: {e}")
        print("  Check that the broker is running and the connection details are correct.")
        sys.exit(1)

    print()

    # Execute requested action
    if args.list_only:
        list_topics(admin)
    elif args.delete:
        ok = delete_topics(admin)
        sys.exit(0 if ok else 1)
    else:
        ok = create_topics(admin, args)
        print()
        list_topics(admin)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

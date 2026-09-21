#!/bin/bash
# =============================================================================
#  MCG CRM — grant the CDC principal its binlog-reading rights
# =============================================================================
#  Runs once, as root, on the first boot of an empty data volume. Recreating
#  the container against an existing volume does NOT re-run it.
#
#  This is a shell script rather than a .sql file because the account name and
#  password come from the environment. MySQL's SQL has no variable
#  substitution, so a .sql file would have to hardcode them — and then any
#  MYSQL_USER / MYSQL_PASSWORD override would produce an account with rights on
#  mcg_crm but no REPLICATION grants, and CDC would fail with access-denied
#  against a user that looks correctly configured.
#
#  Qlik's Data Movement Gateway reads the binary log, which needs global
#  REPLICATION grants. Those cannot be scoped per-database, so they go on *.*
#  while the actual data read stays scoped to MYSQL_DATABASE. The alternative
#  the gateway's own bundled MySQL ships with is connecting as root, which is
#  worse.
# =============================================================================
set -euo pipefail

USER_NAME="${MYSQL_USER:-qlik_cdc}"
DB_NAME="${MYSQL_DATABASE:-mcg_crm}"

echo "[mcg] granting CDC rights to '${USER_NAME}'@'%' on ${DB_NAME}"

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
GRANT REPLICATION SLAVE, REPLICATION CLIENT, RELOAD, SHOW DATABASES
  ON *.* TO '${USER_NAME}'@'%';
GRANT SELECT ON \`${DB_NAME}\`.* TO '${USER_NAME}'@'%';
FLUSH PRIVILEGES;
SQL

echo "[mcg] CDC grants applied"

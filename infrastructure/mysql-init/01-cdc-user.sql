-- ===========================================================================
--  MCG CRM — the CDC principal Qlik connects as
-- ===========================================================================
--  Mounted into /docker-entrypoint-initdb.d/ and run once, by root, on the
--  very first boot of an empty data volume. Recreating the container against
--  an existing volume does NOT re-run this file.
--
--  Qlik's Data Movement Gateway reads the binary log, which needs global
--  REPLICATION grants. Those cannot be granted per-database, so they are
--  granted on *.* while the actual data read is scoped to mcg_crm. The
--  alternative the DMG container ships with today is connecting as root,
--  which is worse.
--
--  MYSQL_PASSWORD is the compose-provided password for the same account, so
--  the gateway and the simulators share one credential set.
-- ===========================================================================

-- The compose MYSQL_USER/MYSQL_PASSWORD pair already created this account and
-- gave it rights on mcg_crm. It still needs the log-reading grants, and it
-- needs to be reachable from outside the container network.
CREATE USER IF NOT EXISTS 'qlik_cdc'@'%' IDENTIFIED BY 'mcg_crm_2025';

-- Log-based CDC: read the binlog, see the server's replication state.
GRANT REPLICATION SLAVE, REPLICATION CLIENT, RELOAD, SHOW DATABASES
  ON *.* TO 'qlik_cdc'@'%';

-- The initial full load reads the tables directly.
GRANT SELECT ON mcg_crm.* TO 'qlik_cdc'@'%';

FLUSH PRIVILEGES;

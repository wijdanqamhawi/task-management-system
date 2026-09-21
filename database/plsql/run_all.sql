-- T026 — Install both PL/SQL packages (specifications, then bodies).
-- Usage: sqlplus tms_user/<password>@//localhost:1521/FREEPDB1 @run_all.sql
SET ECHO ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

@@pkg_dashboard.pks
@@pkg_notification.pks

-- Bodies are implemented in their own tasks:
--   pkg_dashboard.pkb    -> T108 (User Story 6)
--   pkg_notification.pkb -> T130 (User Story 8)

PROMPT ================================================
PROMPT  Package specifications installed.
PROMPT  Bodies follow in Phase 8 (T108) and Phase 10 (T130).
PROMPT ================================================
SHOW ERRORS

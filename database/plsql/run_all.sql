-- T026 — Install both PL/SQL packages (specifications, then bodies).
-- Usage: sqlplus tms_user/<password>@//localhost:1521/FREEPDB1 @run_all.sql
SET ECHO ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

@@pkg_dashboard.pks
@@pkg_notification.pks

@@pkg_dashboard.pkb
@@pkg_notification.pkb

PROMPT ================================================
PROMPT  Package specifications and bodies installed.
PROMPT ================================================
SHOW ERRORS

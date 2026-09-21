-- T021 — Install the schema in dependency order.
-- Usage: sqlplus tms_user/<password>@//localhost:1521/FREEPDB1 @run_all.sql
SET ECHO ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

@@01_reference.sql
@@02_users.sql
@@03_projects.sql
@@04_tasks.sql
@@05_task_detail.sql
@@06_notifications.sql
@@07_indexes.sql

PROMPT ================================================
PROMPT  Schema installed. Next: @../plsql/run_all.sql
PROMPT  then @../seed/reference_data.sql
PROMPT ================================================

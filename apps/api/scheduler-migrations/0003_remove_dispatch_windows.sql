-- Work keeps its original availability, leases and retry state when dispatch windows are retired.
DROP TRIGGER scheduler_register_kind;
DROP TRIGGER scheduler_register_changed_kind;
DROP INDEX scheduler_kind_ready;
DROP TABLE scheduler_dispatch_windows;

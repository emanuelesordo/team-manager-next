-- CSI returns HTTP 403 from Supabase/GitHub datacenters. The installed Python
-- scraper runs through the local daily Codex automation; keep cloud fetch off.
update private.csi_sync_settings set enabled=false where singleton;
select cron.unschedule(jobid) from cron.job where jobname='team-manager-csi-daily';

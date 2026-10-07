select f.id,f.match_code,f.source_url,f.home_team,f.away_team,c.minutes_per_period
from public.app_competition_fixtures f
join public.app_competitions c on c.id=f.competition_id
left join public.app_match_source_checks checks on checks.fixture_id=f.id
where nullif(trim(f.source_url),'') is not null and not coalesce(f.is_test,false)
  and (checks.last_attempt_at is null
       or (checks.last_attempt_at at time zone 'Europe/Rome')::date < (now() at time zone 'Europe/Rome')::date
       or checks.source_url is distinct from f.source_url)
order by f.kickoff_at,f.id;

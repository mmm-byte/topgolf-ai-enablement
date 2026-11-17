-- PostgreSQL-style SQL starter. Keep the date range aligned to the source coverage.
select
  cast(to_char(calendar_date, 'YYYYMMDD') as integer) as date_key,
  calendar_date::date as date,
  extract(year from calendar_date) as year,
  extract(quarter from calendar_date) as quarter,
  extract(month from calendar_date) as month_number,
  trim(to_char(calendar_date, 'Month')) as month_name,
  to_char(calendar_date, 'Mon') as month_short,
  extract(day from calendar_date) as day_of_month,
  trim(to_char(calendar_date, 'Day')) as day_of_week
from generate_series(date '2025-01-01', date '2025-11-17', interval '1 day') as dates(calendar_date);

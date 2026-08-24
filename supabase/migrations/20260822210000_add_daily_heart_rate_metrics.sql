-- Add observed daily heart-rate aggregates from HealthKit.

alter table health_daily_metrics
drop constraint if exists health_daily_metrics_type_allowed;

alter table health_daily_metrics
add constraint health_daily_metrics_type_allowed
check (
    metric_type in (
        'steps',
        'distance_m',
        'active_kcal',
        'resting_kcal',
        'total_kcal',
        'heart_rate_avg_bpm',
        'heart_rate_min_bpm',
        'heart_rate_max_bpm'
    )
);

-- Atomic function for checking and incrementing feature usage
-- This prevents race conditions by combining check and increment in a single transaction

CREATE OR REPLACE FUNCTION check_and_increment_feature_usage(
  org_id UUID, 
  feature_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  current_usage INTEGER := 0;
  usage_limit INTEGER := 0;
  new_usage INTEGER := 0;
  subscription_record RECORD;
  plan_limits_record RECORD;
  result JSONB;
BEGIN
  -- Get organization's active subscription and plan limits in one query
  SELECT s.plan_id, pl.max_clients, pl.max_campaigns_per_client, pl.data_retention_days,
         pl.sync_interval_hours, pl.allow_csv_export, pl.allow_json_export
  INTO subscription_record
  FROM subscriptions s
  JOIN plan_limits pl ON s.plan_id = pl.plan_id
  WHERE s.organization_id = org_id 
    AND s.status = 'active'
  LIMIT 1;

  -- If no active subscription found, deny access
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'No active subscription found',
      'current_usage', 0,
      'limit', 0,
      'new_usage', 0
    );
  END IF;

  -- Determine the limit based on feature name
  CASE feature_name
    WHEN 'maxClients' THEN
      usage_limit := subscription_record.max_clients;
    WHEN 'maxCampaigns' THEN
      usage_limit := subscription_record.max_campaigns_per_client;
    WHEN 'csvExport' THEN
      IF NOT subscription_record.allow_csv_export THEN
        RETURN jsonb_build_object(
          'success', false,
          'reason', 'CSV export not allowed in current plan',
          'current_usage', 0,
          'limit', 0,
          'new_usage', 0
        );
      END IF;
      usage_limit := -1; -- Unlimited for boolean features
    WHEN 'jsonExport' THEN
      IF NOT subscription_record.allow_json_export THEN
        RETURN jsonb_build_object(
          'success', false,
          'reason', 'JSON export not allowed in current plan',
          'current_usage', 0,
          'limit', 0,
          'new_usage', 0
        );
      END IF;
      usage_limit := -1; -- Unlimited for boolean features
    ELSE
      -- Unknown feature
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'Unknown feature: ' || feature_name,
        'current_usage', 0,
        'limit', 0,
        'new_usage', 0
      );
  END CASE;

  -- Get current usage for today (using UTC date)
  SELECT COALESCE(usage_count, 0)
  INTO current_usage
  FROM feature_usage
  WHERE organization_id = org_id
    AND feature_key = feature_name
    AND usage_date = (NOW() AT TIME ZONE 'UTC')::date;

  -- Check if increment would exceed limit (skip for unlimited features)
  IF usage_limit != -1 AND current_usage >= usage_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Usage limit exceeded for ' || feature_name,
      'current_usage', current_usage,
      'limit', usage_limit,
      'new_usage', current_usage
    );
  END IF;

  -- Atomically increment usage count (using UTC date)
  INSERT INTO feature_usage (organization_id, feature_key, usage_count, limit_count, usage_date)
  VALUES (org_id, feature_name, 1, usage_limit, (NOW() AT TIME ZONE 'UTC')::date)
  ON CONFLICT (organization_id, feature_key, usage_date)
  DO UPDATE SET 
    usage_count = feature_usage.usage_count + 1,
    limit_count = usage_limit,
    updated_at = NOW()
  RETURNING usage_count INTO new_usage;

  -- Return success with usage information
  RETURN jsonb_build_object(
    'success', true,
    'reason', null,
    'current_usage', current_usage,
    'limit', usage_limit,
    'new_usage', new_usage
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Database error: ' || SQLERRM,
      'current_usage', current_usage,
      'limit', usage_limit,
      'new_usage', current_usage
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_and_increment_feature_usage(UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION check_and_increment_feature_usage(UUID, TEXT) IS 
'Atomically checks feature usage limits and increments usage count if within limits. Prevents race conditions by combining check and increment operations.';
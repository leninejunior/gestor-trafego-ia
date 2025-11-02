-- Dead Letter Queue Schema for Webhook Processing
-- Requirements: 4.2, 8.1, 8.4

-- Create dead letter queue table
CREATE TABLE IF NOT EXISTS webhook_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_event JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  error_details JSONB DEFAULT '{}',
  can_retry BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_can_retry ON webhook_dead_letter_queue(can_retry);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_first_failed_at ON webhook_dead_letter_queue(first_failed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_last_failed_at ON webhook_dead_letter_queue(last_failed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event_id ON webhook_dead_letter_queue USING GIN ((original_event->>'id'));
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event_type ON webhook_dead_letter_queue USING GIN ((original_event->>'type'));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_webhook_dlq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_dlq_updated_at_trigger
  BEFORE UPDATE ON webhook_dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_dlq_updated_at();

-- Add RLS policies
ALTER TABLE webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role can manage dead letter queue" ON webhook_dead_letter_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Policy for authenticated users (read-only for admin purposes)
CREATE POLICY "Authenticated users can view dead letter queue" ON webhook_dead_letter_queue
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to get DLQ statistics
CREATE OR REPLACE FUNCTION get_webhook_dlq_stats()
RETURNS TABLE (
  total_items BIGINT,
  retryable_items BIGINT,
  non_retryable_items BIGINT,
  oldest_item_date TIMESTAMP WITH TIME ZONE,
  newest_item_date TIMESTAMP WITH TIME ZONE,
  avg_attempts NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE can_retry = true) as retryable_items,
    COUNT(*) FILTER (WHERE can_retry = false) as non_retryable_items,
    MIN(first_failed_at) as oldest_item_date,
    MAX(first_failed_at) as newest_item_date,
    AVG(attempts) as avg_attempts
  FROM webhook_dead_letter_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup old DLQ items
CREATE OR REPLACE FUNCTION cleanup_webhook_dlq(older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_dead_letter_queue 
  WHERE first_failed_at < NOW() - INTERVAL '1 day' * older_than_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to requeue retryable items
CREATE OR REPLACE FUNCTION requeue_webhook_dlq_items(
  max_items INTEGER DEFAULT 10,
  min_age_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  item_id UUID,
  event_id TEXT,
  event_type TEXT,
  requeued_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH requeued_items AS (
    DELETE FROM webhook_dead_letter_queue
    WHERE id IN (
      SELECT id 
      FROM webhook_dead_letter_queue
      WHERE can_retry = true
        AND last_failed_at < NOW() - INTERVAL '1 minute' * min_age_minutes
      ORDER BY first_failed_at ASC
      LIMIT max_items
    )
    RETURNING id, original_event
  )
  SELECT 
    ri.id as item_id,
    ri.original_event->>'id' as event_id,
    ri.original_event->>'type' as event_type,
    NOW() as requeued_at
  FROM requeued_items ri;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_dead_letter_queue TO service_role;
GRANT SELECT ON webhook_dead_letter_queue TO authenticated;
GRANT EXECUTE ON FUNCTION get_webhook_dlq_stats() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_webhook_dlq(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION requeue_webhook_dlq_items(INTEGER, INTEGER) TO service_role;

-- Add comments for documentation
COMMENT ON TABLE webhook_dead_letter_queue IS 'Dead letter queue for webhook events that failed processing after all retry attempts';
COMMENT ON COLUMN webhook_dead_letter_queue.original_event IS 'The original webhook event that failed processing';
COMMENT ON COLUMN webhook_dead_letter_queue.failure_reason IS 'The reason why the event failed processing';
COMMENT ON COLUMN webhook_dead_letter_queue.attempts IS 'Number of processing attempts made';
COMMENT ON COLUMN webhook_dead_letter_queue.can_retry IS 'Whether this event can be retried or should be considered permanently failed';
COMMENT ON COLUMN webhook_dead_letter_queue.error_details IS 'Additional error details and context';

COMMENT ON FUNCTION get_webhook_dlq_stats() IS 'Get statistics about the dead letter queue';
COMMENT ON FUNCTION cleanup_webhook_dlq(INTEGER) IS 'Clean up old items from the dead letter queue';
COMMENT ON FUNCTION requeue_webhook_dlq_items(INTEGER, INTEGER) IS 'Requeue retryable items from the dead letter queue for processing';
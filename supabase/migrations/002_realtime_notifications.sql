-- Enable Supabase Realtime on user_notifications so clients can subscribe
-- to INSERT events filtered by recipient_user_id.
alter publication supabase_realtime add table user_notifications;

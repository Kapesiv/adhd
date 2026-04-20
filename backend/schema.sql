CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    wake_up_time TEXT NOT NULL,
    sleep_hours REAL NOT NULL,
    intensity_preference TEXT NOT NULL DEFAULT 'medium',
    tz_offset_minutes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subs_wake ON push_subscriptions(wake_up_time);

CREATE TABLE IF NOT EXISTS delivery_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    reminder_slot TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    success INTEGER NOT NULL,
    message TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_sub_slot ON delivery_log(subscription_id, reminder_slot, sent_at);

CREATE TABLE IF NOT EXISTS pending_messages (
    subscription_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

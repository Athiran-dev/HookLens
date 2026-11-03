-- User feedback. The length check is enforced here as well as in the API so junk can never be stored.
CREATE TABLE feedback (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   text NOT NULL CHECK (category IN ('bug','idea','question','other')),
    message    text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
    page       text NOT NULL DEFAULT '',
    user_agent text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_created_idx ON feedback(created_at DESC);
CREATE INDEX feedback_user_idx ON feedback(user_id, created_at DESC);

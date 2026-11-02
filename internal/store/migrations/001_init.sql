CREATE TABLE users (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email          text NOT NULL UNIQUE,
    password_hash  text NOT NULL,
    retention_days int  NOT NULL DEFAULT 7,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspaces_owner_idx ON workspaces(owner_id);

-- Opaque bearer tokens: browser sessions, CLI logins and user-created API keys.
CREATE TABLE auth_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('session','cli','api')),
    name         text NOT NULL DEFAULT '',
    token_hash   bytea NOT NULL UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    expires_at   timestamptz
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens(user_id);

-- CLI device-login handshake.
CREATE TABLE device_codes (
    device_code_hash bytea PRIMARY KEY,
    user_code        text NOT NULL UNIQUE,
    user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
    token            text NOT NULL DEFAULT '',
    expires_at       timestamptz NOT NULL
);

CREATE TABLE endpoints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    public_token    text NOT NULL UNIQUE,
    name            text NOT NULL,
    status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    forward_url     text NOT NULL DEFAULT '',
    request_count   bigint NOT NULL DEFAULT 0,
    last_request_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX endpoints_workspace_idx ON endpoints(workspace_id);

CREATE TABLE requests (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id  uuid NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    method       text NOT NULL,
    path         text NOT NULL,
    query        text NOT NULL DEFAULT '',
    headers      jsonb NOT NULL,
    body         bytea NOT NULL,
    content_type text NOT NULL DEFAULT '',
    source_ip    text NOT NULL DEFAULT '',
    size         int  NOT NULL,
    received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX requests_endpoint_received_idx ON requests(endpoint_id, received_at DESC);
CREATE INDEX requests_received_idx ON requests(received_at);

CREATE TABLE deliveries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id       uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    kind             text NOT NULL CHECK (kind IN ('forward','replay')),
    status           text NOT NULL CHECK (status IN ('pending','delivered','failed','no_tunnel')),
    destination      text NOT NULL DEFAULT '',
    response_code    int,
    response_headers jsonb,
    response_body    bytea,
    duration_ms      int,
    error            text NOT NULL DEFAULT '',
    created_at       timestamptz NOT NULL DEFAULT now(),
    completed_at     timestamptz
);
CREATE INDEX deliveries_request_idx ON deliveries(request_id, created_at DESC);

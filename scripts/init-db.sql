-- Create uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    role VARCHAR NOT NULL CHECK (role IN ('admin', 'gestor', 'vendedor')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Token Blacklist Table
CREATE TABLE token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    reason VARCHAR
);

-- Role Permissions Table
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR NOT NULL CHECK (role IN ('admin', 'gestor', 'vendedor')),
    action VARCHAR NOT NULL,
    resource VARCHAR NOT NULL,
    UNIQUE(role, action, resource)
);

-- Indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- Pre-populate Role Permissions (16 standard permissions)
-- Admin permissions (8)
INSERT INTO role_permissions (role, action, resource) VALUES
('admin', 'create', 'users'),
('admin', 'read', 'users'),
('admin', 'update', 'users'),
('admin', 'delete', 'users'),
('admin', 'manage', 'roles'),
('admin', 'revoke', 'tokens'),
('admin', 'read', 'stats'),
('admin', 'manage', 'system');

-- Gestor permissions (5)
INSERT INTO role_permissions (role, action, resource) VALUES
('gestor', 'read', 'users'),
('gestor', 'update', 'users'),
('gestor', 'moderate', 'content'),
('gestor', 'read', 'content'),
('gestor', 'update', 'content');

-- Vendedor permissions (3)
INSERT INTO role_permissions (role, action, resource) VALUES
('vendedor', 'read', 'own_profile'),
('vendedor', 'update', 'own_profile'),
('vendedor', 'create', 'content');

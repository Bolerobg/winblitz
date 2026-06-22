-- Create tables

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    fullname VARCHAR(100),
    city VARCHAR(50),
    address TEXT,
    verified BOOLEAN DEFAULT FALSE,
    sms_code VARCHAR(10),
    balance NUMERIC(10, 2) DEFAULT 100.00,
    xp INTEGER DEFAULT 0,
    clan_id INTEGER,
    active_avatar VARCHAR(10) DEFAULT '👤',
    active_theme VARCHAR(50) DEFAULT 'default',
    unlocked_avatars TEXT[] DEFAULT ARRAY['👤'],
    unlocked_themes TEXT[] DEFAULT ARRAY['default'],
    loot_boxes_owned INTEGER DEFAULT 0,
    unlocked_achievements TEXT[] DEFAULT ARRAY[]::TEXT[],
    daily_quests JSONB DEFAULT '[]'::JSONB,
    last_spin_date VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS wallet_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'deposit' or 'withdrawal'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS won_prizes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    prize_name VARCHAR(100) NOT NULL,
    prize_value NUMERIC(10, 2) NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending' or 'shipped'
    archive_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lobbies (
    id SERIAL PRIMARY KEY,
    prize_name VARCHAR(100) NOT NULL,
    prize_value NUMERIC(10, 2) NOT NULL,
    ticket_price NUMERIC(10, 2) NOT NULL,
    max_players INTEGER NOT NULL,
    product_type VARCHAR(50) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    image TEXT,
    product_url TEXT,
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    players JSONB DEFAULT '[]'::JSONB,
    winner VARCHAR(100),
    is_friend_duel BOOLEAN DEFAULT FALSE,
    is_practice BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS completed_games (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER,
    prize_name VARCHAR(100) NOT NULL,
    prize_value NUMERIC(10, 2) NOT NULL,
    ticket_price NUMERIC(10, 2) NOT NULL,
    max_players INTEGER NOT NULL,
    winner VARCHAR(100) NOT NULL,
    completed_at VARCHAR(100) NOT NULL,
    players JSONB DEFAULT '[]'::JSONB,
    is_practice BOOLEAN DEFAULT FALSE,
    is_friend_duel BOOLEAN DEFAULT FALSE,
    archive_id BIGINT NOT NULL,
    product_url TEXT,
    product_type VARCHAR(50),
    image TEXT,
    delivery_status VARCHAR(20) DEFAULT 'pending'
);

-- Seed default lobbies if they do not exist
INSERT INTO lobbies (id, prize_name, prize_value, ticket_price, max_players, product_type, game_type, image, product_url, status, players, winner, is_friend_duel, is_practice)
VALUES
(1, 'Сервиз за еспресо', 45.00, 10.00, 5, 'wallpaper', 'math', 'coffee_set.png', 'https://www.technopolis.bg/bg/Espreso-mashini/Kafemashina-DELONGHI-EC221-B/p/823812', 'waiting', '[]', NULL, FALSE, FALSE),
(2, 'Кафемашина Krups Dolce Gusto', 90.00, 15.00, 7, 'guide', 'memory', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop', 'https://www.technopolis.bg/bg/Kafemashini-s-kapsuli/Kafemashina-s-kapsuli-KRUPS-KP1A3B-Dolce-Gusto-Piccolo-XS/p/824368', 'waiting', '[]', NULL, FALSE, FALSE),
(3, 'Премиум комплект зърна (1кг)', 35.00, 5.00, 8, 'voucher', 'reflex', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop', 'https://www.dabov.bg/en/product/dabov-specialty-coffee-signature-blend/', 'waiting', '[]', NULL, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Migration queries (ensure compatibility with pre-existing tables)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_spin_date VARCHAR(50);
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS product_url TEXT;
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS product_type VARCHAR(50);
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'pending';

-- Email and Password auth migrations
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Lobbies and completed_games practice/friend duel migrations
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS is_friend_duel BOOLEAN DEFAULT FALSE;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT FALSE;
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT FALSE;
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS is_friend_duel BOOLEAN DEFAULT FALSE;

-- Normalize existing NULL arrays
UPDATE users SET unlocked_achievements = ARRAY[]::TEXT[] WHERE unlocked_achievements IS NULL;
UPDATE users SET unlocked_avatars = ARRAY['👤']::TEXT[] WHERE unlocked_avatars IS NULL;
UPDATE users SET unlocked_themes = ARRAY['default']::TEXT[] WHERE unlocked_themes IS NULL;



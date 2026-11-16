CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  phone VARCHAR(30),
  department VARCHAR(100),
  year VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  venue VARCHAR(180) NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
  registration_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  prize_money NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_instructions TEXT,
  pamphlet_url TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(30),
  department VARCHAR(100),
  year VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','attended','cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id,user_id)
);

CREATE TABLE IF NOT EXISTS event_winners (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  winner_name VARCHAR(120) NOT NULL,
  winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  winner_email VARCHAR(255),
  prize_amount INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id,position)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);

-- Upgrade existing EventHub databases without deleting existing records.
ALTER TABLE event_winners ADD COLUMN IF NOT EXISTS winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE event_winners ADD COLUMN IF NOT EXISTS winner_email VARCHAR(255);

-- Enforce case-insensitive uniqueness for college email addresses.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users (LOWER(email));

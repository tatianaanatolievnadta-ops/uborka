-- Выполните в Supabase SQL Editor (проект wapnyeblryyxotnavnae, регион eu-west-1)
-- Dashboard → SQL → New query

-- Профиль пользователя (настройки, подписка, геймификация)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  provider TEXT DEFAULT 'email',
  subscription JSONB DEFAULT '{"status":"trial","trialStartDate":null,"planType":"premium","billing":null,"bonusDays":0}'::jsonb,
  gamification JSONB DEFAULT '{}'::jsonb,
  last_visit_date TIMESTAMPTZ DEFAULT NOW(),
  deletion_warning_shown BOOLEAN DEFAULT FALSE,
  active_house_id TEXT,
  referral_code TEXT,
  referrals_count INT DEFAULT 0,
  referral_bonus_days INT DEFAULT 0,
  referred_by UUID,
  notif_settings JSONB DEFAULT '{"enabled":false,"permission":"default","permissionRequested":false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS houses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width NUMERIC,
  length NUMERIC,
  area NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority TEXT DEFAULT 'green',
  skip_count INT DEFAULT 0,
  estimated_minutes INT DEFAULT 15,
  period JSONB DEFAULT '{"type":"days","count":1,"value":7}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_completed TIMESTAMPTZ,
  completed_today BOOLEAN DEFAULT FALSE,
  last_timed_seconds INT,
  recommendations JSONB DEFAULT '{}'::jsonb,
  products JSONB DEFAULT '[]'::jsonb,
  show_rec BOOLEAN DEFAULT FALSE,
  location TEXT,
  floor_area NUMERIC
);

CREATE INDEX IF NOT EXISTS houses_user_id_idx ON houses(user_id);
CREATE INDEX IF NOT EXISTS rooms_user_id_idx ON rooms(user_id);
CREATE INDEX IF NOT EXISTS rooms_house_id_idx ON rooms(house_id);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_room_id_idx ON tasks(room_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "houses_own" ON houses;
CREATE POLICY "houses_own" ON houses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rooms_own" ON rooms;
CREATE POLICY "rooms_own" ON rooms FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_own" ON tasks;
CREATE POLICY "tasks_own" ON tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Автосоздание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, provider, subscription, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    jsonb_build_object(
      'status', 'trial',
      'trialStartDate', NOW(),
      'planType', 'premium',
      'billing', NULL,
      'bonusDays', 0
    ),
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS floor_area NUMERIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

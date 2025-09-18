-- Create user profiles table for public profile information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_pages table to store user's saved URLs
CREATE TABLE IF NOT EXISTS public.saved_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    domain TEXT,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',

    -- Prevent duplicate saves by same user
    UNIQUE(user_id, url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_saved_pages_user_id ON public.saved_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pages_saved_at ON public.saved_pages(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_pages_user_saved_at ON public.saved_pages(user_id, saved_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (is_public = true);

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for saved_pages
CREATE POLICY "Users can view their own saved pages"
    ON public.saved_pages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Public saved pages viewable via profile"
    ON public.saved_pages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = saved_pages.user_id
            AND profiles.is_public = true
        )
    );

CREATE POLICY "Users can insert their own saved pages"
    ON public.saved_pages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved pages"
    ON public.saved_pages FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved pages"
    ON public.saved_pages FOR DELETE
    USING (auth.uid() = user_id);

-- Create RPC function to get saved pages for a user (newest 100)
CREATE OR REPLACE FUNCTION public.get_saved_pages(username_param TEXT)
RETURNS TABLE (
    id UUID,
    url TEXT,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    domain TEXT,
    saved_at TIMESTAMPTZ,
    metadata JSONB
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT
        sp.id,
        sp.url,
        sp.title,
        sp.description,
        sp.thumbnail_url,
        sp.domain,
        sp.saved_at,
        sp.metadata
    FROM public.saved_pages sp
    JOIN public.profiles p ON sp.user_id = p.id
    WHERE p.username = username_param
    AND p.is_public = true
    ORDER BY sp.saved_at DESC
    LIMIT 100;
$$;

-- Create function to get user profile by username
CREATE OR REPLACE FUNCTION public.get_profile_by_username(username_param TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_public BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.bio,
        p.avatar_url,
        p.is_public,
        p.created_at
    FROM public.profiles p
    WHERE p.username = username_param
    AND p.is_public = true;
$$;

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.saved_pages TO anon, authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.saved_pages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saved_pages(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO anon, authenticated;
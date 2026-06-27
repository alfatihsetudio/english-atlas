-- SQL script to reset all user XP and rank points to zero
UPDATE public.profiles
SET rank_points = 0,
    highest_rank_points = 0;

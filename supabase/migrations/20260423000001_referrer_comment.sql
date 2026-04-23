-- Add optional comment from referrer (소개자의 한마디) shown on the friend's public profile.
-- Saved when the referrer approves the friend via /api/referral/verify with `referrerComment`.
alter table profiles add column if not exists referrer_comment text;

do $$
declare
    v_identity_count integer;
begin
    select count(distinct p.nickname)
    into v_identity_count
    from public.user_credentials c
    join public.profiles p
      on lower(btrim(p.nickname)) = lower(btrim(c.nickname))
    where p.nickname in ('Gogo', 'Gigi');

    if v_identity_count <> 2 then
        raise exception 'Expected exactly two mapped profiles (Gogo and Gigi), found %', v_identity_count;
    end if;
end;
$$;

create table public.app_identities (
    profile_id uuid primary key references public.profiles (id) on delete restrict,
    identity text not null unique check (identity in ('Gogo', 'Gigi')),
    password_hash text not null,
    created_at timestamp with time zone not null default now()
);

alter table public.app_identities enable row level security;

revoke all on table public.app_identities from public, anon, authenticated;
grant select on table public.app_identities to service_role;

insert into public.app_identities (profile_id, identity, password_hash, created_at)
select
    p.id,
    p.nickname,
    c.password_hash,
    timestamptz '2025-05-22 01:23:45+08'
from public.profiles p
join public.user_credentials c
  on lower(btrim(c.nickname)) = lower(btrim(p.nickname))
where p.nickname in ('Gogo', 'Gigi');

do $$
declare
    v_identity_count integer;
begin
    select count(*)
    into v_identity_count
    from public.app_identities;

    if v_identity_count <> 2 then
        raise exception 'Expected exactly two app identity rows after migration, found %', v_identity_count;
    end if;
end;
$$;

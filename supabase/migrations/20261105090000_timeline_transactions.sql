begin;

create or replace function public.app_check_in(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_profile public.profiles%rowtype;
    today date := (now() at time zone 'Asia/Shanghai')::date;
begin
    select * into current_profile from public.profiles where id = p_profile_id for update;
    if not found or current_profile.nickname is null or current_profile.nickname not in ('Gogo', 'Gigi') then
        raise exception '身份资料不存在';
    end if;
    if exists (
        select 1 from public.calendar_events
        where type = 'checkin' and date = today
          and (author_id = p_profile_id or author_name = current_profile.nickname)
    ) then
        return jsonb_build_object('awarded', false, 'points', current_profile.points);
    end if;
    insert into public.calendar_events (date, content, type, mood, author_id, author_name)
    values (today, '完成了今日恋爱签到 ✨', 'checkin', 'happy', p_profile_id, current_profile.nickname);
    update public.profiles set points = coalesce(points, 0) + 10
    where id = p_profile_id returning * into current_profile;
    return jsonb_build_object('awarded', true, 'points', current_profile.points);
end;
$$;

create or replace function public.app_soothe_event(p_profile_id uuid, p_event_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_profile public.profiles%rowtype;
    target_event public.calendar_events%rowtype;
begin
    select * into current_profile from public.profiles where id = p_profile_id for update;
    if not found or current_profile.nickname is null or current_profile.nickname not in ('Gogo', 'Gigi') then
        raise exception '身份资料不存在';
    end if;
    select * into target_event from public.calendar_events where id = p_event_id for update;
    if not found then raise exception '日记不存在'; end if;
    if target_event.author_id = p_profile_id or target_event.author_name = current_profile.nickname then
        raise exception '不能哄自己哦';
    end if;
    if target_event.mood is null or target_event.mood not in ('angry', 'sos') then
        return jsonb_build_object('awarded', false, 'points', current_profile.points);
    end if;
    update public.calendar_events set mood = 'happy', content = '已经哄好啦 ❤️' where id = p_event_id;
    update public.profiles set points = coalesce(points, 0) + 50
    where id = p_profile_id returning * into current_profile;
    return jsonb_build_object('awarded', true, 'points', current_profile.points);
end;
$$;

revoke all on function public.app_check_in(uuid) from public, anon, authenticated;
revoke all on function public.app_soothe_event(uuid, bigint) from public, anon, authenticated;
grant execute on function public.app_check_in(uuid) to service_role;
grant execute on function public.app_soothe_event(uuid, bigint) to service_role;

commit;

-- ════════════════════════════════════════════════════════════
--  02._.book — ตารางเพิ่มเติมบนโปรเจกต์ Supabase ของ 02._.mock
--  ใช้คำนำหน้า bk_ ทั้งหมดเพื่อไม่ทับของเดิม (app_state / profiles / attempts)
--  รันซ้ำได้ปลอดภัย (idempotent)
-- ════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

-- ── บัญชีของเว็บนี้ (ผู้ปกครอง / ครู / เจ้าของ) ─────────────
create table if not exists public.bk_accounts (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  role           text not null default 'parent' check (role in ('owner','teacher','parent')),
  name           text default '',
  email          text default '',
  phone          text default '',
  line_id        text default '',
  password_plain text default '',      -- ให้เจ้าของระบบดูได้ (ตามที่เจ้าของกำหนด)
  teacher_code   text,                 -- code เดิมจาก 02._.mock (ถ้าเป็นครู)
  org_id         text,                 -- หน่วยงานของครู (เจ้าของเป็นคนเลือกให้)
  org_hint       text default '',      -- ชื่อหน่วยงานที่ครูพิมพ์เองตอนสมัคร
  approved       boolean not null default true,   -- ครูสมัครใหม่ = false
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists bk_accounts_teacher_code_key
  on public.bk_accounts (lower(teacher_code)) where teacher_code is not null;

-- ── คอร์สที่ขาย ────────────────────────────────────────────
create table if not exists public.bk_courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text default '',
  detail      text default '',
  image_url   text default '',
  price       integer not null default 0,
  hours       integer not null default 0,
  lessons     integer not null default 0,
  seats       integer not null default 0,     -- 0 = ไม่จำกัด
  level       text default '',
  subject     text default 'คณิตศาสตร์',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── ตั้งค่าเว็บ (แถวเดียว id = 1) ──────────────────────────
create table if not exists public.bk_settings (
  id             integer primary key default 1 check (id = 1),
  promptpay_type text not null default 'phone',
  promptpay_id   text default '',
  promptpay_name text default '',
  contact_line   text default '',
  contact_phone  text default '',
  notice         text default '',
  updated_at     timestamptz not null default now()
);

-- ── ผู้ปกครอง ↔ นักเรียน (นักเรียนอ้างถึง students ใน app_state ของ 02._.mock)
create table if not exists public.bk_parent_students (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  student_id   text not null,
  student_code text default '',
  student_name text default '',
  org_id       text default '',
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (user_id, student_id)
);

-- ── คำสั่งซื้อคอร์ส ────────────────────────────────────────
create table if not exists public.bk_orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     uuid references public.bk_courses(id) on delete set null,
  course_title  text default '',
  student_name  text default '',
  amount        integer not null default 0,
  status        text not null default 'pending_payment'
                check (status in ('pending_payment','pending_confirm','confirmed','rejected')),
  slip_path     text default '',
  note          text default '',
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists bk_orders_user_idx on public.bk_orders (user_id, created_at desc);
create index if not exists bk_orders_status_idx on public.bk_orders (status);

-- ════════════════════════════════════════════════════════════
--  ฟังก์ชันช่วย (security definer เพื่อไม่วน RLS)
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.bk_accounts where user_id = auth.uid();
$$;

create or replace function public.bk_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.bk_role() = 'owner', false);
$$;

create or replace function public.bk_is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.bk_role() = 'teacher', false);
$$;

create or replace function public.bk_org()
returns text language sql stable security definer set search_path = public as $$
  select org_id from public.bk_accounts where user_id = auth.uid();
$$;

-- ครูเห็นผู้ปกครองได้เฉพาะคนที่มีนักเรียนในหน่วยงานของตัวเอง
create or replace function public.bk_parent_in_my_org(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bk_parent_students s
    where s.user_id = p_user and s.org_id = public.bk_org()
  );
$$;

-- ════════════════════════════════════════════════════════════
--  RLS
-- ════════════════════════════════════════════════════════════
alter table public.bk_accounts         enable row level security;
alter table public.bk_courses          enable row level security;
alter table public.bk_settings         enable row level security;
alter table public.bk_parent_students  enable row level security;
alter table public.bk_orders           enable row level security;

-- accounts: เจ้าของเห็นหมด / ครูเห็นผู้ปกครองทั้งหมด (เฉพาะคอลัมน์ที่เว็บดึง) / ผู้ปกครองเห็นตัวเอง
drop policy if exists bk_accounts_select on public.bk_accounts;
create policy bk_accounts_select on public.bk_accounts
  for select using (
    user_id = auth.uid()
    or public.bk_is_owner()
    or (public.bk_is_teacher() and role = 'parent')
  );

drop policy if exists bk_accounts_insert on public.bk_accounts;
create policy bk_accounts_insert on public.bk_accounts
  for insert with check (user_id = auth.uid() or public.bk_is_owner());

drop policy if exists bk_accounts_update on public.bk_accounts;
create policy bk_accounts_update on public.bk_accounts
  for update using (user_id = auth.uid() or public.bk_is_owner())
  with check (user_id = auth.uid() or public.bk_is_owner());

drop policy if exists bk_accounts_delete on public.bk_accounts;
create policy bk_accounts_delete on public.bk_accounts
  for delete using (public.bk_is_owner());

-- courses: ทุกคนดูคอร์สที่เปิดอยู่ได้ เจ้าของคนเดียวที่แก้
drop policy if exists bk_courses_select on public.bk_courses;
create policy bk_courses_select on public.bk_courses
  for select using (active = true or public.bk_is_owner());

drop policy if exists bk_courses_write on public.bk_courses;
create policy bk_courses_write on public.bk_courses
  for all using (public.bk_is_owner()) with check (public.bk_is_owner());

-- settings: อ่านได้ทุกคน (ต้องใช้ทำ QR) เขียนเฉพาะเจ้าของ
drop policy if exists bk_settings_select on public.bk_settings;
create policy bk_settings_select on public.bk_settings
  for select using (true);

drop policy if exists bk_settings_write on public.bk_settings;
create policy bk_settings_write on public.bk_settings
  for all using (public.bk_is_owner()) with check (public.bk_is_owner());

-- parent_students: เจ้าของเห็นหมด / ครูเห็นเฉพาะหน่วยงานตัวเอง
drop policy if exists bk_ps_select on public.bk_parent_students;
create policy bk_ps_select on public.bk_parent_students
  for select using (
    user_id = auth.uid() or public.bk_is_owner()
    or (public.bk_is_teacher() and org_id = public.bk_org())
  );

drop policy if exists bk_ps_write on public.bk_parent_students;
create policy bk_ps_write on public.bk_parent_students
  for all using (
    public.bk_is_owner()
    or (public.bk_is_teacher() and org_id = public.bk_org())
  ) with check (
    public.bk_is_owner()
    or (public.bk_is_teacher() and org_id = public.bk_org())
  );

-- orders
drop policy if exists bk_orders_select on public.bk_orders;
create policy bk_orders_select on public.bk_orders
  for select using (user_id = auth.uid() or public.bk_is_owner());

drop policy if exists bk_orders_insert on public.bk_orders;
create policy bk_orders_insert on public.bk_orders
  for insert with check (user_id = auth.uid());

drop policy if exists bk_orders_update on public.bk_orders;
create policy bk_orders_update on public.bk_orders
  for update using (user_id = auth.uid() or public.bk_is_owner())
  with check (user_id = auth.uid() or public.bk_is_owner());

-- ════════════════════════════════════════════════════════════
--  Storage: สลิป (ส่วนตัว) + ปกคอร์ส (สาธารณะ)
-- ════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('bk-slips', 'bk-slips', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('bk-covers', 'bk-covers', true)
on conflict (id) do nothing;

drop policy if exists bk_slips_insert on storage.objects;
create policy bk_slips_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bk-slips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists bk_slips_select on storage.objects;
create policy bk_slips_select on storage.objects
  for select to authenticated
  using (bucket_id = 'bk-slips' and ((storage.foldername(name))[1] = auth.uid()::text or public.bk_is_owner()));

drop policy if exists bk_slips_delete on storage.objects;
create policy bk_slips_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'bk-slips' and ((storage.foldername(name))[1] = auth.uid()::text or public.bk_is_owner()));

drop policy if exists bk_covers_read on storage.objects;
create policy bk_covers_read on storage.objects
  for select using (bucket_id = 'bk-covers');

drop policy if exists bk_covers_write on storage.objects;
create policy bk_covers_write on storage.objects
  for all to authenticated
  using (bucket_id = 'bk-covers' and public.bk_is_owner())
  with check (bucket_id = 'bk-covers' and public.bk_is_owner());

-- ════════════════════════════════════════════════════════════
--  ค่าเริ่มต้น
-- ════════════════════════════════════════════════════════════
insert into public.bk_settings (id, promptpay_type, promptpay_id, promptpay_name, contact_line, contact_phone, notice)
values (1, 'phone', '0617806696', 'Wich Pitchon', 'buun - nuum', '061-780-6696', '')
on conflict (id) do nothing;

insert into public.bk_courses (title, subtitle, detail, price, hours, lessons, seats, level, sort_order)
select * from (values
  ('คณิตศาสตร์ ม.ปลาย — ปูพื้นให้แน่น',
   'เรียนตัวต่อตัว เน้นเข้าใจจริง ไม่ท่องจำ',
   'ปรับพื้นฐานตั้งแต่ต้นจนต่อยอดได้ เหมาะกับน้องที่เกลียดคณิตหรือเรียนไม่ทันเพื่อน',
   1800, 4, 4, 8, 'ม.4–ม.6', 1),
  ('ตะลุยโจทย์ A-Level คณิต 1',
   'ทำข้อสอบจริงจับเวลา ตรวจละเอียดรายข้อ',
   'เน้นเทคนิคทำเร็ว วิเคราะห์ข้อสอบย้อนหลัง พร้อมเฉลยละเอียดทุกข้อ',
   2400, 6, 6, 12, 'ม.6', 2),
  ('แคลคูลัสเบื้องต้นสำหรับเด็ก ม.ปลาย',
   'เตรียมความพร้อมก่อนเข้ามหาวิทยาลัย',
   'ปูพื้นฐานลิมิต อนุพันธ์ ปริพันธ์ ให้เข้าใจภาพรวมก่อนเรียนจริง',
   2000, 5, 5, 6, 'ม.5–ม.6', 3)
) as seed(title, subtitle, detail, price, hours, lessons, seats, level, sort_order)
where not exists (select 1 from public.bk_courses);

-- ════════════════════════════════════════════════════════════
--  ครูเพิ่ม/ลบนักเรียนให้ผู้ปกครอง (ตรวจหน่วยงานจาก app_state ของ 02._.mock)
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_student_in_org(p_student_id text, p_org text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.app_state s,
         jsonb_array_elements(coalesce(s.data->'students', '[]'::jsonb)) st
    where s.id = 'main'
      and st->>'id' = p_student_id
      and coalesce(st->>'orgId', '') = coalesce(p_org, '')
  );
$$;

create or replace function public.bk_teacher_link_student(p_parent uuid, p_student_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org text := public.bk_org();
  v_stu jsonb;
begin
  if not public.bk_is_teacher() then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;
  select st into v_stu
  from public.app_state s, jsonb_array_elements(coalesce(s.data->'students','[]'::jsonb)) st
  where s.id = 'main' and st->>'id' = p_student_id
  limit 1;
  if v_stu is null then raise exception 'ไม่พบนักเรียนคนนี้'; end if;
  if coalesce(v_stu->>'orgId','') <> coalesce(v_org,'') then
    raise exception 'นักเรียนคนนี้ไม่ได้อยู่หน่วยงานของคุณ';
  end if;

  insert into public.bk_parent_students (user_id, student_id, student_code, student_name, org_id, created_by)
  values (p_parent, p_student_id, coalesce(v_stu->>'code',''), coalesce(v_stu->>'name',''), coalesce(v_stu->>'orgId',''), auth.uid())
  on conflict (user_id, student_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.bk_teacher_unlink_student(p_link uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org text := public.bk_org();
begin
  if not public.bk_is_teacher() and not public.bk_is_owner() then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  delete from public.bk_parent_students
  where id = p_link and (public.bk_is_owner() or org_id = v_org);
  return jsonb_build_object('ok', true);
end;
$$;

-- ════════════════════════════════════════════════════════════
--  ซิงก์บัญชีครูจาก 02._.mock (สร้าง auth user ให้อัตโนมัติ)
--  - ครั้งแรก (ยังไม่มีเจ้าของ) เรียกได้แม้ยังไม่ล็อกอิน เพื่อ bootstrap
--  - หลังจากนั้นเฉพาะเจ้าของระบบ
--  อีเมลภายใน: <code-ที่ทำเป็น slug>@teacher.02book.local
--  รหัสผ่าน: ใช้รหัสเดิมจาก 02._.mock
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_teacher_email(p_code text)
returns text language sql immutable as $$
  select trim(both '-' from lower(regexp_replace(coalesce(p_code,''), '[^a-zA-Z0-9]+', '-', 'g'))) || '@teacher.02book.local';
$$;

create or replace function public.bk_sync_teachers()
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  r record; v_id uuid; v_email text; v_role text; n int := 0; total int := 0;
  v_owner_exists boolean := exists (select 1 from public.bk_accounts where role = 'owner');
begin
  if v_owner_exists and not public.bk_is_owner() then
    raise exception 'เฉพาะเจ้าของระบบ';
  end if;

  for r in
    select t from public.app_state s, jsonb_array_elements(coalesce(s.data->'teachers','[]'::jsonb)) t
    where s.id = 'main'
  loop
    v_email := public.bk_teacher_email(r.t->>'code');
    if v_email is null or v_email = '@teacher.02book.local' then continue; end if;
    total := total + 1;
    v_role := case when coalesce((r.t->>'isOwner')::boolean, false) then 'owner' else 'teacher' end;

    select id into v_id from auth.users where email = v_email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change, email_change_token_new,
                              email_change_token_current, phone_change, phone_change_token,
                              is_sso_user, is_anonymous)
      values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
              crypt(coalesce(nullif(r.t->>'password',''), '123456'), gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('full_name', coalesce(r.t->>'name','')), now(), now(),
              '', '', '', '', '', '', '', false, false);
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id,
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
              'email', v_id::text, now(), now(), now())
      on conflict do nothing;
      n := n + 1;
    end if;

    insert into public.bk_accounts (user_id, role, name, email, teacher_code, org_id, org_hint, approved)
    values (v_id, v_role, coalesce(r.t->>'name',''), v_email, coalesce(r.t->>'code',''),
            coalesce(r.t->>'orgId',''), coalesce(r.t->>'school',''), true)
    on conflict (user_id) do update set
      name = excluded.name,
      teacher_code = excluded.teacher_code,
      org_hint = excluded.org_hint,
      role = case when excluded.role = 'owner' then 'owner' else public.bk_accounts.role end,
      org_id = coalesce(public.bk_accounts.org_id, excluded.org_id),
      updated_at = now();
  end loop;

  return jsonb_build_object('teachers', total, 'created', n);
end;
$$;

-- ════════════════════════════════════════════════════════════
--  รายงานคะแนนของนักเรียน 1 คน (ให้ผู้ปกครองที่ผูกไว้ดูได้)
--  เคารพ settings.showScore / showSolutions ของชุดสอบ
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_student_report(p_student_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_state jsonb;
  v_student jsonb;
  v_allowed boolean;
  v_exams jsonb := '[]'::jsonb;
  v_item jsonb;
  e jsonb;
  q jsonb;
  a jsonb;
  v_att jsonb;
  v_ans text;
  v_score numeric;
  v_max numeric;
  v_show_solutions boolean;
  v_show_score boolean;
  v_questions jsonb;
  v_org_name text;
begin
  select data into v_state from public.app_state where id = 'main';
  if v_state is null then return null; end if;

  v_allowed := public.bk_is_owner()
    or exists (
      select 1 from public.bk_parent_students ps
      where ps.user_id = v_uid and ps.student_id = p_student_id
    )
    or exists (
      select 1 from public.bk_parent_students ps
      where ps.student_id = p_student_id and ps.org_id = public.bk_org() and public.bk_is_teacher()
    );
  if not v_allowed then raise exception 'ไม่มีสิทธิ์ดูข้อมูลนักเรียนคนนี้'; end if;

  select st into v_student
  from jsonb_array_elements(coalesce(v_state->'students','[]'::jsonb)) st
  where st->>'id' = p_student_id limit 1;

  if v_student is null then return null; end if;

  select o->>'name' into v_org_name
  from jsonb_array_elements(coalesce(v_state->'organizations','[]'::jsonb)) o
  where o->>'id' = v_student->>'orgId' limit 1;

  for e in select value from jsonb_array_elements(coalesce(v_state->'exams','[]'::jsonb)) value loop
    continue when coalesce(e->>'deletedAt','') <> '';

    select a2.data into v_att
    from public.attempts a2
    where a2.student_id = p_student_id and a2.exam_id = e->>'id'
    order by a2.updated_at desc
    limit 1;
    if v_att is null then continue; end if;
    if coalesce(v_att->>'status','') <> 'submitted' and coalesce(v_att->>'status','') <> 'graded' then continue; end if;

    v_show_solutions := coalesce((e->'settings'->>'showSolutions')::boolean, true);
    v_show_score := coalesce((e->'settings'->>'showScore')::boolean, true);

    v_score := 0; v_max := 0; v_questions := '[]'::jsonb;
    for q in select value from jsonb_array_elements(coalesce(e->'questions','[]'::jsonb)) value loop
      v_max := v_max + coalesce((q->>'points')::numeric, 0);
      v_ans := coalesce(v_att->'answers'->(q->>'id')->>'value', '');
      if coalesce(v_att->>'overrideScore','') = '' then
        if lower(trim(v_ans)) = lower(trim(coalesce(q->>'correct',''))) and trim(v_ans) <> '' then
          v_score := v_score + coalesce((q->>'points')::numeric, 0);
        elsif coalesce(q->>'type','') = 'short'
              and exists (select 1 from jsonb_array_elements_text(coalesce(q->'acceptedAnswers','[]'::jsonb)) av
                          where lower(trim(av)) = lower(trim(v_ans))) and trim(v_ans) <> '' then
          v_score := v_score + coalesce((q->>'points')::numeric, 0);
        elsif v_att->'manualScores'->(q->>'id') is not null then
          v_score := v_score + coalesce((v_att->'manualScores'->(q->>'id')->>'score')::numeric, 0);
        end if;
      end if;

      v_questions := v_questions || jsonb_build_array(
        jsonb_build_object(
          'id', q->>'id', 'type', q->>'type', 'points', q->'points', 'text', q->>'text',
          'options', coalesce(q->'options','[]'::jsonb),
          'answer', v_ans,
          'manual', v_att->'manualScores'->(q->>'id'),
          'correct', case when v_show_solutions then q->'correct' else null end,
          'acceptedAnswers', case when v_show_solutions then coalesce(q->'acceptedAnswers','[]'::jsonb) else null end,
          'explanation', case when v_show_solutions then q->>'explanation' else null end
        )
      );
    end loop;

    if coalesce(v_att->>'overrideScore','') <> '' then
      v_score := coalesce((v_att->>'overrideScore')::numeric, 0);
    end if;

    v_item := jsonb_build_object(
      'examId', e->>'id',
      'title', e->>'title',
      'subject', e->>'subject',
      'topic', e->>'topic',
      'level', e->>'level',
      'teacherName', e->>'teacherName',
      'date', coalesce(v_att->>'submittedAt', v_att->>'updatedAt'),
      'score', case when v_show_score then v_score else null end,
      'max', case when v_show_score then v_max else null end,
      'percent', case when v_show_score and v_max > 0 then round((v_score / v_max) * 100) else null end,
      'showScore', v_show_score,
      'showSolutions', v_show_solutions,
      'questions', v_questions
    );
    v_exams := v_exams || jsonb_build_array(v_item);
  end loop;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student->>'id', 'name', v_student->>'name', 'code', v_student->>'code',
      'class', v_student->>'class', 'orgName', coalesce(v_org_name, '')
    ),
    'exams', v_exams
  );
end;
$$;

grant execute on function public.bk_sync_teachers() to anon, authenticated;
grant execute on function public.bk_student_report(text) to authenticated;
grant execute on function public.bk_teacher_link_student(uuid, text) to authenticated;
grant execute on function public.bk_teacher_unlink_student(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════
--  รายชื่อนักเรียน/หน่วยงานจาก 02._.mock (ใช้ผูกกับผู้ปกครอง)
--  ครูเห็นเฉพาะหน่วยงานตัวเอง · เจ้าของเห็นทั้งหมด
--  ไม่ส่งรหัสผ่านหรือข้อมูลอ่อนไหวออกไป
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_roster()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_state jsonb;
  v_org text := public.bk_org();
  v_all boolean := public.bk_is_owner();
  v_students jsonb := '[]'::jsonb;
  v_orgs jsonb := '[]'::jsonb;
  st jsonb;
  o jsonb;
begin
  if auth.uid() is null then raise exception 'ต้องเข้าสู่ระบบ'; end if;
  if not (public.bk_is_owner() or public.bk_is_teacher()) then raise exception 'ไม่มีสิทธิ์'; end if;

  select data into v_state from public.app_state where id = 'main';
  if v_state is null then return jsonb_build_object('students', '[]'::jsonb, 'organizations', '[]'::jsonb); end if;

  for o in select value from jsonb_array_elements(coalesce(v_state->'organizations','[]'::jsonb)) value loop
    if v_all or coalesce(o->>'id','') = coalesce(v_org,'') then
      v_orgs := v_orgs || jsonb_build_array(jsonb_build_object('id', o->>'id', 'name', o->>'name', 'type', o->>'type'));
    end if;
  end loop;

  for st in select value from jsonb_array_elements(coalesce(v_state->'students','[]'::jsonb)) value loop
    if v_all or coalesce(st->>'orgId','') = coalesce(v_org,'') then
      v_students := v_students || jsonb_build_array(jsonb_build_object(
        'id', st->>'id', 'code', st->>'code', 'name', st->>'name',
        'class', st->>'class', 'orgId', st->>'orgId',
        'orgName', coalesce((select o2->>'name' from jsonb_array_elements(coalesce(v_state->'organizations','[]'::jsonb)) o2 where o2->>'id' = st->>'orgId' limit 1), '')
      ));
    end if;
  end loop;

  return jsonb_build_object('students', v_students, 'organizations', v_orgs, 'orgId', v_org, 'isOwner', v_all);
end;
$$;

grant execute on function public.bk_roster() to authenticated;

-- ════════════════════════════════════════════════════════════
--  จำนวนที่นั่งที่ถูกจองแล้ว (อ่านได้ทุกคน เพื่อโชว์ "เหลือ n ที่นั่ง")
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_course_seats()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(course_id, n), '{}'::jsonb) from (
    select course_id::text as course_id, count(*)::int as n
    from public.bk_orders
    where status in ('pending_confirm','confirmed') and course_id is not null
    group by course_id
  ) t;
$$;

grant execute on function public.bk_course_seats() to anon, authenticated;
grant execute on function public.bk_teacher_email(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════
--  สมัครผู้ปกครองเอง (ไม่พึ่งอีเมลของ Supabase → ไม่ติด rate limit)
--  สร้าง auth user ให้ทันที + ยืนยันอีเมลให้เลย แล้วให้เว็บล็อกอินต่อ
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_signup_parent(
  p_email text, p_password text, p_name text, p_phone text, p_line text
) returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'อีเมลไม่ถูกต้อง';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
  end if;
  if v_name = '' then
    raise exception 'กรุณากรอกชื่อผู้ปกครอง';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'อีเมลนี้มีบัญชีอยู่แล้ว — เข้าสู่ระบบได้เลย';
  end if;

  v_id := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change, email_change_token_new,
                          email_change_token_current, phone_change, phone_change_token,
                          is_sso_user, is_anonymous)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
          crypt(p_password, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_name), now(), now(),
          '', '', '', '', '', '', '', false, false);

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', v_id::text, now(), now(), now())
  on conflict do nothing;

  insert into public.bk_accounts (user_id, role, name, email, phone, line_id, password_plain, approved)
  values (v_id, 'parent', v_name, v_email, trim(coalesce(p_phone,'')), trim(coalesce(p_line,'')), p_password, true)
  on conflict (user_id) do update set
    name = excluded.name, email = excluded.email, phone = excluded.phone,
    line_id = excluded.line_id, password_plain = excluded.password_plain, updated_at = now();

  return jsonb_build_object('ok', true, 'user_id', v_id);
end;
$$;

grant execute on function public.bk_signup_parent(text, text, text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════
--  ข้อมูลครู 1 คนจากรายชื่อบุคลากรของ 02._.mock (ใช้ตอนล็อกอิน)
-- ════════════════════════════════════════════════════════════
create or replace function public.bk_teacher_profile(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'code', t->>'code', 'name', coalesce(t->>'name',''),
           'orgId', coalesce(t->>'orgId',''), 'school', coalesce(t->>'school',''),
           'subject', coalesce(t->>'subject',''),
           'isOwner', coalesce((t->>'isOwner')::boolean, false))
  from public.app_state s, jsonb_array_elements(coalesce(s.data->'teachers','[]'::jsonb)) t
  where s.id = 'main' and lower(t->>'code') = lower(trim(coalesce(p_code,'')))
  limit 1;
$$;

grant execute on function public.bk_teacher_profile(text) to anon, authenticated;

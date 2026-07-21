create sequence if not exists private.product_number_seq
  as smallint
  minvalue 1
  maxvalue 999
  no cycle;

alter table public.products
  add column if not exists product_number smallint;

do $$
declare
  v_max_number integer;
  v_sequence_number integer;
  v_sequence_called boolean;
  v_product record;
begin
  select coalesce(max(product_number), 0)
    into v_max_number
  from public.products;

  select last_value, is_called
    into v_sequence_number, v_sequence_called
  from private.product_number_seq;

  v_sequence_number := case
    when v_sequence_called then v_sequence_number
    else 0
  end;

  if greatest(v_max_number, v_sequence_number) = 0 then
    perform setval('private.product_number_seq', 1, false);
  else
    perform setval(
      'private.product_number_seq',
      greatest(v_max_number, v_sequence_number),
      true
    );
  end if;

  for v_product in
    select id
    from public.products
    where product_number is null
    order by updated_at, id
  loop
    update public.products
    set product_number = nextval('private.product_number_seq')
    where id = v_product.id;
  end loop;
end;
$$;

alter table public.products
  alter column product_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_product_number_range'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_number_range
      check (product_number between 1 and 999);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_product_number_key'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_number_key unique (product_number);
  end if;
end;
$$;

create or replace function public.admin_product_mutation(
  p_passcode text,
  p_action text,
  p_product jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_product_number smallint;
begin
  if not exists (
    select 1
    from private.admin_config c
    where c.id = 1
      and c.passcode_hash = extensions.crypt(p_passcode, c.passcode_hash)
  ) then
    raise exception 'Invalid passcode' using errcode = '28000';
  end if;

  if p_action = 'verify' then
    return jsonb_build_object('ok', true);
  end if;

  v_id := nullif(trim(p_product->>'id'), '');
  if v_id is null then
    raise exception 'Product id is required';
  end if;

  if p_action = 'upsert' then
    select product_number
      into v_product_number
    from public.products
    where id = v_id;

    if found then
      update public.products
      set
        name = trim(p_product->>'name'),
        category = trim(p_product->>'category'),
        free = coalesce((p_product->>'free')::boolean, false),
        price = greatest(coalesce((p_product->>'price')::integer, 0), 0),
        description = coalesce(p_product->>'description', ''),
        status = case
          when p_product->>'status' in ('available', 'reserved', 'sold')
            then p_product->>'status'
          else 'available'
        end,
        photo = coalesce(p_product->>'photo', ''),
        updated_at = now()
      where id = v_id;
    else
      begin
        v_product_number := nextval('private.product_number_seq');
      exception
        when sequence_generator_limit_exceeded then
          raise exception 'Product number limit 999 reached'
            using errcode = '2200H';
      end;

      insert into public.products (
        id, product_number, name, category, free, price,
        description, status, photo, updated_at
      ) values (
        v_id,
        v_product_number,
        trim(p_product->>'name'),
        trim(p_product->>'category'),
        coalesce((p_product->>'free')::boolean, false),
        greatest(coalesce((p_product->>'price')::integer, 0), 0),
        coalesce(p_product->>'description', ''),
        case
          when p_product->>'status' in ('available', 'reserved', 'sold')
            then p_product->>'status'
          else 'available'
        end,
        coalesce(p_product->>'photo', ''),
        now()
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'id', v_id,
      'product_number', v_product_number
    );
  elsif p_action = 'delete' then
    delete from public.products where id = v_id;
    return jsonb_build_object('ok', true, 'id', v_id);
  else
    raise exception 'Unsupported action';
  end if;
end;
$$;

revoke all on function public.admin_product_mutation(text, text, jsonb) from public;
grant execute on function public.admin_product_mutation(text, text, jsonb) to anon, authenticated;

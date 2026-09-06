-- 2P Box | Liga pedidos de convidado à conta pelo e-mail
-- Executa após 20260905_customer_accounts.sql.

create or replace function public.link_guest_orders_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    update public.orders
       set customer_id = new.id
     where customer_id is null
       and customer_email is not null
       and lower(trim(customer_email)) = lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_link_guest_orders on auth.users;
create trigger on_auth_user_link_guest_orders
after insert or update on auth.users
for each row execute procedure public.link_guest_orders_to_auth_user();
-- 2P Box | preços oficiais da Central de Impressão
-- Fonte: tabela de preços fornecida pela loja em 19/09/2026.
-- Não são incluídos preços coloridos porque a tabela fornecida não informa valor para colorido.

do $$
declare
  v_paper uuid;
begin
  select id into v_paper from public.print_paper_types order by sort_order, created_at limit 1;
  if v_paper is null then
    insert into public.print_paper_types(name,size,active,sort_order)
    values ('Papel comum A4','A4',true,1)
    returning id into v_paper;
  else
    update public.print_paper_types set name='Papel comum A4', size='A4', active=true where id=v_paper;
  end if;

  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  select v_paper,'bw',1,50,0.40 where not exists (
    select 1 from public.print_price_tiers where paper_type_id=v_paper and color_mode='bw' and min_sheets=1 and max_sheets=50
  );
  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  select v_paper,'bw',51,100,0.35 where not exists (
    select 1 from public.print_price_tiers where paper_type_id=v_paper and color_mode='bw' and min_sheets=51 and max_sheets=100
  );
  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  select v_paper,'bw',101,150,0.30 where not exists (
    select 1 from public.print_price_tiers where paper_type_id=v_paper and color_mode='bw' and min_sheets=101 and max_sheets=150
  );
  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  select v_paper,'bw',151,200,0.25 where not exists (
    select 1 from public.print_price_tiers where paper_type_id=v_paper and color_mode='bw' and min_sheets=151 and max_sheets=200
  );
end $$;

update public.print_services
set name='Plastificação — Folha A4', description='Plastificação de folha A4', charge_type='per_sheet', price=5.00, active=true, sort_order=10
where name ilike 'Plastificação%';

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Plastificação — RG / Cartão SUS','Plastificação de RG ou Cartão SUS. Valor por unidade.','per_document',3.00,true,11
where not exists (select 1 from public.print_services where name='Plastificação — RG / Cartão SUS');

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Plastificação — Cartão vacina','Plastificação de cartão de vacina. Valor por unidade.','per_document',4.00,true,12
where not exists (select 1 from public.print_services where name='Plastificação — Cartão vacina');

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Encadernação 1 a 50 folhas','Encadernação para trabalhos com 1 a 50 folhas.','per_document',5.00,true,20
where not exists (select 1 from public.print_services where name='Encadernação 1 a 50 folhas');

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Encadernação 51 a 100 folhas','Encadernação para trabalhos com 51 a 100 folhas.','per_document',6.00,true,21
where not exists (select 1 from public.print_services where name='Encadernação 51 a 100 folhas');

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Encadernação 101 a 150 folhas','Encadernação para trabalhos com 101 a 150 folhas.','per_document',7.00,true,22
where not exists (select 1 from public.print_services where name='Encadernação 101 a 150 folhas');

insert into public.print_services(name,description,charge_type,price,active,sort_order)
select 'Encadernação 151 a 200 folhas','Encadernação para trabalhos com 151 a 200 folhas.','per_document',8.00,true,23
where not exists (select 1 from public.print_services where name='Encadernação 151 a 200 folhas');

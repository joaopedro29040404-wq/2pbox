-- 2P Box | corrigir faixas A4 para a tabela oficial da loja
-- A tabela fornecida em 19/09/2026 define somente estas faixas de Xerox/P&B para A4.

do $$
declare
  v_paper uuid;
begin
  select id into v_paper from public.print_paper_types where name='Papel comum A4' order by sort_order, created_at limit 1;
  if v_paper is null then
    raise exception 'Papel comum A4 não encontrado';
  end if;

  delete from public.print_price_tiers where paper_type_id=v_paper;

  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  values
    (v_paper,'bw',1,50,0.40),
    (v_paper,'bw',51,100,0.35),
    (v_paper,'bw',101,150,0.30),
    (v_paper,'bw',151,200,0.25);
end $$;

-- =============================================================================
-- Chat: texto do aviso de passagem para a equipe (01/10/2026, pedido do Ricardo)
-- Troca só a mensagem que o assistente grava ao passar a conversa para a equipe: não dá a entender que
-- alguém responde já; diz o horário (segunda a sexta, 9h às 18h) e que o aviso da resposta vai para o e-mail
-- da conta. Mesma assinatura e mesmo retorno (boolean): "create or replace" mantém dono e permissões.
-- A mesma definição está em 20261003_chat_bot.sql (rodar aquele de novo dá o mesmo resultado).
-- Aplicar à mão no SQL Editor, DEPOIS de 20261003_chat_bot.sql. NÃO vai para supabase/migrations.
-- Idempotente.
-- =============================================================================
begin;

create or replace function public.chat_bot_passar(p_conv uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_user uuid;
  v_aviso constant text := 'Você já tem conversas abertas com a nossa equipe; continue por uma delas.';
begin
  select c.user_id into v_user from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
  if not found then
    return false;
  end if;
  if p_motivo not in ('erro', 'atendente') then
    perform pg_advisory_xact_lock(hashtext('chat:' || v_user::text));
    if (select count(*) from public.conversations c where c.user_id = v_user and c.status = 'open' and c.bot_state = 'humano') >= 3 then
      -- o aviso não se repete seguido (botão e "Não" de novo, sem nada escrito entre eles)
      if (select m.sender_role is distinct from 'bot' or m.body is distinct from v_aviso
          from public.conversation_messages m where m.conversation_id = p_conv
          order by m.created_at desc, m.id desc limit 1) is not false then
        insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
        values (p_conv, null, 'bot', 'Assistente Evokaa', v_aviso, clock_timestamp());
      end if;
      return false;
    end if;
  end if;
  update public.conversations c
  set bot_state = 'humano', handoff_at = now(), handoff_reason = p_motivo,
      agent_last_read_at = null, team_alerted_at = null, updated_at = now()
  where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
  if not found then
    return false;
  end if;
  v_cfg := public.chat_public_settings();
  -- aviso de passagem (Ricardo, 01/10): não dá a entender que alguém responde já; diz o horário e que o
  -- aviso da resposta vai para o e-mail (WhatsApp só quando houver integração).
  -- ponytail: horário escrito no texto; se o admin passar a editar chat_settings.hours, montar daqui.
  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
  values (p_conv, null, 'system', 'Evokaa',
          case p_motivo
            when 'pedido' then 'Certo! Sua conversa foi para a nossa equipe.'
            when 'nao_resolveu' then 'Que pena que não resolveu. Sua conversa foi para a nossa equipe.'
            when 'sem_resposta' then 'Não encontrei essa resposta na nossa central de ajuda, então sua conversa foi para a nossa equipe.'
            else 'Sua conversa foi para a nossa equipe.' end
          || case when coalesce((v_cfg ->> 'aberto_agora')::boolean, false)
                  then ' Nosso atendimento é de segunda a sexta, das 9h às 18h, e a resposta chega aqui no chat.'
                  else ' Nosso atendimento é de segunda a sexta, das 9h às 18h. Agora estamos fora desse horário, então a resposta chega aqui no chat no próximo período de atendimento.' end
          || ' Se você não estiver por aqui quando a equipe responder, avisamos no e-mail da sua conta.',
          clock_timestamp());
  return true;
end;
$$;

-- Conferência: a função nova está no ar e continua fechada para quem chega pela API
do $$
begin
  if position('das 9h às 18h' in pg_get_functiondef('public.chat_bot_passar(uuid, text)'::regprocedure)) = 0 then
    raise exception 'chat_bot_passar sem o texto novo';
  end if;
  if has_function_privilege('authenticated', 'public.chat_bot_passar(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.chat_bot_passar(uuid, text)', 'execute') then
    raise exception 'chat_bot_passar executável pelo navegador';
  end if;
end;
$$;

commit;

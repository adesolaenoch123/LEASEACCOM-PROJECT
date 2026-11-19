-- Keep existing messages while consolidating duplicate property conversations.
with ranked_conversations as (
  select
    id,
    first_value(id) over (
      partition by property_id, tenant_id, owner_id
      order by created_at, id
    ) as canonical_id
  from public.conversations
  where property_id is not null
)
update public.messages as message
set conversation_id = ranked.canonical_id
from ranked_conversations as ranked
where message.conversation_id = ranked.id
  and ranked.id <> ranked.canonical_id;

with ranked_conversations as (
  select
    id,
    first_value(id) over (
      partition by property_id, tenant_id, owner_id
      order by created_at, id
    ) as canonical_id
  from public.conversations
  where property_id is not null
)
delete from public.conversations as conversation
using ranked_conversations as ranked
where conversation.id = ranked.id
  and ranked.id <> ranked.canonical_id;

create unique index if not exists conversations_property_participants_unique_idx
  on public.conversations (property_id, tenant_id, owner_id)
  where property_id is not null;

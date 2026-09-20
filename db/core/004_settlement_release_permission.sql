-- Production settlement release permission.
-- Grants manual D1 release only to finance/super-admin roles.

insert into controlplane.permissions(code,domain,description,sensitivity)
values(
  'settlements.release',
  'settlements',
  'Release a pending settlement into available merchant balance after provider release verification.',
  'CRITICAL'
)
on conflict (code) do update
set description=excluded.description,
    sensitivity=excluded.sensitivity;

insert into controlplane.role_permissions(role_id,permission_id)
select r.id,p.id
from controlplane.roles r
join controlplane.permissions p on p.code='settlements.release'
where r.code in ('SUPER_ADMIN','FINANCE_ADMIN')
on conflict (role_id,permission_id) do nothing;

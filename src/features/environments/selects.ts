/**
 * PostgREST selects for environments and services. Composite FKs are named so embeds are
 * unambiguous; kept outside the server-only module so integration tests run the same strings.
 */

export const ENVIRONMENT_LIST_SELECT =
  "id, project_id, name, environment_type, status, application_url, deployment_provider, last_reviewed_at, updated_at, project:projects!environments_project_owner_fkey(id, name, status), environment_variables(count), service_instances(count)"

export const ENVIRONMENT_DETAIL_SELECT =
  "*, project:projects!environments_project_owner_fkey(id, name, status)"

export const ENVIRONMENT_INSTANCES_SELECT =
  "id, project_service_id, resource_name, region, endpoint_hostname, version_or_plan, status, related_variables, notes, service:project_services!service_instances_service_project_fkey(id, name, category, provider, dashboard_url, documentation_url)"

export const SERVICE_LIST_SELECT =
  "id, project_id, name, category, provider, purpose, dashboard_url, documentation_url, notes, updated_at, account_id, account:accounts!project_services_account_owner_fkey(id, platform, label), project:projects!project_services_project_owner_fkey(id, name), instances:service_instances(id, environment_id, resource_name, region, endpoint_hostname, version_or_plan, status, related_variables, notes, environment:environments!service_instances_environment_project_fkey(id, name, environment_type, status))"

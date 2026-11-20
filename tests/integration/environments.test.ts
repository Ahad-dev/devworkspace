import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  ENVIRONMENT_DETAIL_SELECT,
  ENVIRONMENT_INSTANCES_SELECT,
  ENVIRONMENT_LIST_SELECT,
  SERVICE_LIST_SELECT,
} from "../../src/features/environments/selects"
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 5 (Spec FR-08, FR-09, §9.3; Plan P5.1–P5.3, P5.9): environments, services, instances,
 * secret references and environment-variable metadata. The database refuses secret material,
 * cross-project links and unearned "integration verified" claims.
 */
describe("environments, services and configuration metadata", () => {
  let a: TestUser
  let b: TestUser
  let p1: string
  let p2: string

  beforeAll(async () => {
    a = await createTestUser("p5a")
    b = await createTestUser("p5b")
    p1 = await project(a, "Env one")
    p2 = await project(a, "Env two")
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  async function project(user: TestUser, name: string) {
    const { data, error } = await user.client
      .from("projects")
      .insert({ name, project_type: "client" })
      .select("id")
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function environment(
    user: TestUser,
    projectId: string,
    name: string,
    extra: Record<string, unknown> = {},
  ) {
    const { data, error } = await user.client
      .from("environments")
      .insert({ project_id: projectId, name, environment_type: "development", ...extra })
      .select("id")
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function service(projectId: string, name: string) {
    const { data, error } = await a.client
      .from("project_services")
      .insert({ project_id: projectId, name, category: "database" })
      .select("id")
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  describe("environments", () => {
    it("stores non-secret metadata and refuses credentials", async () => {
      const ok = await a.client
        .from("environments")
        .insert({
          project_id: p1,
          name: "Production",
          environment_type: "production",
          application_url: "https://app.example.com",
          server_hostname: "10.0.0.12:22",
          runtime_versions: { node: "24.11", pnpm: "10.33" },
          deployment_branch: "main",
          notes: "Deploys from main through Vercel. Secrets live in Doppler (project portal/prd).",
        })
        .select("id, status, runtime_versions")
        .single()
      expect(ok.error).toBeNull()
      expect(ok.data).toMatchObject({ status: "active", runtime_versions: { node: "24.11" } })

      const bad: Record<string, unknown>[] = [
        { application_url: "https://admin:hunter22@app.example.com" },
        { server_hostname: "deploy@10.0.0.12" },
        { notes: "STRIPE key sk_live_51HxYzAbCdEfGhIjKl" },
        { deployment_method: "ssh with -----BEGIN OPENSSH PRIVATE KEY----- ..." },
        { notes: "DB: postgres://app:s3cretpass@db.internal:5432/app" },
        { runtime_versions: { node: 24 } },
        { runtime_versions: ["node"] },
      ]
      for (const [i, extra] of bad.entries()) {
        const { error } = await a.client
          .from("environments")
          .insert({ project_id: p1, name: `Bad ${i}`, environment_type: "staging", ...extra })
        expect(error?.code, JSON.stringify(extra)).toBe("23514")
      }

      // Names are unique per project, case-insensitively.
      const dup = await a.client
        .from("environments")
        .insert({ project_id: p1, name: "production", environment_type: "production" })
      expect(dup.error?.code).toBe("23505")
    })

    it("records review time on the server", async () => {
      const id = await environment(a, p1, "Reviewed")
      const { data } = await a.client
        .from("environments")
        .update({ last_reviewed_at: "2000-01-01T00:00:00Z" })
        .eq("id", id)
        .select("last_reviewed_at")
        .single()
      expect(Date.now() - Date.parse(data!.last_reviewed_at!)).toBeLessThan(5 * 60_000)
    })

    it("keeps other users out", async () => {
      const id = await environment(a, p1, "Private env")
      expect((await b.client.from("environments").select("id").eq("id", id)).data).toEqual([])
      expect(
        (await b.client.from("environments").update({ notes: "x" }).eq("id", id).select("id")).data,
      ).toEqual([])
      const intrude = await b.client
        .from("environments")
        .insert({ project_id: p1, name: "Intruder", environment_type: "local" })
      expect(intrude.error?.code).toBe("23503")
    })
  })

  describe("services and instances", () => {
    it("links a service to environments of the same project only", async () => {
      const envA = await environment(a, p1, "Svc dev")
      const envOther = await environment(a, p2, "Svc other")
      const pg = await service(p1, "Postgres")

      const ok = await a.client.from("service_instances").insert({
        project_id: p1,
        project_service_id: pg,
        environment_id: envA,
        resource_name: "portal-dev-db",
        endpoint_hostname: "db.dev.internal:5432",
        related_variables: ["DATABASE_URL", "DIRECT_URL"],
        status: "active",
      })
      expect(ok.error).toBeNull()

      // Same service twice in one environment, or across projects, is refused.
      const twice = await a.client
        .from("service_instances")
        .insert({ project_id: p1, project_service_id: pg, environment_id: envA })
      expect(twice.error?.code).toBe("23505")
      const cross = await a.client
        .from("service_instances")
        .insert({ project_id: p1, project_service_id: pg, environment_id: envOther })
      expect(cross.error?.code).toBe("23503")
      const crossProject = await a.client
        .from("service_instances")
        .insert({ project_id: p2, project_service_id: pg, environment_id: envOther })
      expect(crossProject.error?.code).toBe("23503")
    })

    it("refuses credential endpoints and bad variable names", async () => {
      const env = await environment(a, p1, "Svc staging")
      const redis = await service(p1, "Redis")
      for (const extra of [
        { endpoint_hostname: "rediss://default:AbCdEf123456@cache.upstash.io:6379" },
        { endpoint_hostname: "token123@cache.example.com" },
        { related_variables: ["REDIS_URL=rediss://x"] },
        { notes: "token ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
      ]) {
        const { error } = await a.client.from("service_instances").insert({
          project_id: p1,
          project_service_id: redis,
          environment_id: env,
          ...extra,
        })
        expect(error?.code, JSON.stringify(extra)).toBe("23514")
      }
      const badUrl = await a.client
        .from("project_services")
        .insert({ project_id: p1, name: "Leaky", dashboard_url: "https://u:p@dash.example.com" })
      expect(badUrl.error?.code).toBe("23514")
    })
  })

  describe("environment variables and secret references", () => {
    it("has no column that could hold a value", async () => {
      const env = await environment(a, p1, "Vars shape")
      const { data, error } = await a.client
        .from("environment_variables")
        .insert({ project_id: p1, environment_id: env, name: "API_BASE_URL" })
        .select("*")
        .single()
      expect(error).toBeNull()
      expect(Object.keys(data!).sort()).toEqual(
        [
          "configuration_status",
          "created_at",
          "environment_id",
          "id",
          "is_required",
          "is_sensitive",
          "last_verified_at",
          "name",
          "notes",
          "owner_id",
          "project_id",
          "secret_reference_id",
          "updated_at",
          "verification_method",
        ].sort(),
      )
      for (const k of Object.keys(data!)) {
        expect(k).not.toMatch(/^(value|secret|secret_value|password|token|content|raw|raw_value)$/)
      }
    })

    it("accepts names only and keeps them unique per environment", async () => {
      const env = await environment(a, p1, "Vars names")
      const insert = (name: string) =>
        a.client.from("environment_variables").insert({ project_id: p1, environment_id: env, name })
      expect((await insert("DATABASE_URL")).error).toBeNull()
      expect((await insert("DATABASE_URL")).error?.code).toBe("23505")
      for (const name of ["DATABASE_URL=postgres://x", "MY VAR", "1ABC", "A-B", ""]) {
        expect((await insert(name)).error?.code, name).toBe("23514")
      }
      // The variable's project must be its environment's project.
      const mismatch = await a.client
        .from("environment_variables")
        .insert({ project_id: p2, environment_id: env, name: "OTHER" })
      expect(mismatch.error?.code).toBe("23503")
    })

    it("reserves integration verification and maintains last_verified_at", async () => {
      const env = await environment(a, p1, "Vars status")
      const forged = await a.client.from("environment_variables").insert({
        project_id: p1,
        environment_id: env,
        name: "FORGED",
        configuration_status: "configured",
        verification_method: "integration",
      })
      expect(forged.error?.code).toBe("42501")
      expect(forged.error?.hint).toBe("integration_reserved")

      const v = await a.client
        .from("environment_variables")
        .insert({ project_id: p1, environment_id: env, name: "REDIS_URL", is_sensitive: true })
        .select("id, last_verified_at, verification_method")
        .single()
      expect(v.data).toMatchObject({ last_verified_at: null, verification_method: "manual" })

      const configured = await a.client
        .from("environment_variables")
        .update({ configuration_status: "configured" })
        .eq("id", v.data!.id)
        .select("last_verified_at")
        .single()
      expect(configured.data?.last_verified_at).not.toBeNull()

      const upgrade = await a.client
        .from("environment_variables")
        .update({ verification_method: "integration" })
        .eq("id", v.data!.id)
      expect(upgrade.error?.code).toBe("42501")

      // Clients can't write the timestamp directly.
      const ts = await a.client
        .from("environment_variables")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column outside the grant
        .update({ last_verified_at: "2000-01-01T00:00:00Z" } as any)
        .eq("id", v.data!.id)
      expect(ts.error?.code).toBe("42501")

      // A server integration (service_role) may record it.
      const server = await adminClient()
        .from("environment_variables")
        .update({ verification_method: "integration" })
        .eq("id", v.data!.id)
        .select("verification_method")
        .single()
      expect(server.data?.verification_method).toBe("integration")

      const unknown = await a.client
        .from("environment_variables")
        .update({ configuration_status: "unknown", verification_method: "manual" })
        .eq("id", v.data!.id)
        .select("last_verified_at")
        .single()
      expect(unknown.data?.last_verified_at).toBeNull()
    })

    it("links secret references by owner and keeps locators free of secrets", async () => {
      const env = await environment(a, p1, "Vars refs")
      const ref = await a.client
        .from("secret_references")
        .insert({
          provider: "Doppler",
          vault_project_or_workspace: "portal",
          vault_path_or_item_id: "prd",
          key_name: "DATABASE_URL",
          vault_url: "https://dashboard.doppler.com/workplace/portal/prd",
        })
        .select("id")
        .single()
      expect(ref.error).toBeNull()

      const leaky = await a.client.from("secret_references").insert({
        provider: "Other",
        vault_path_or_item_id: "-----BEGIN RSA PRIVATE KEY----- MIIE...",
      })
      expect(leaky.error?.code).toBe("23514")

      const v = await a.client
        .from("environment_variables")
        .insert({
          project_id: p1,
          environment_id: env,
          name: "DATABASE_URL",
          is_sensitive: true,
          secret_reference_id: ref.data!.id,
        })
        .select("id")
        .single()
      expect(v.error).toBeNull()

      // B can't see A's reference or attach it to their own variable.
      expect(
        (await b.client.from("secret_references").select("id").eq("id", ref.data!.id)).data,
      ).toEqual([])
      const bProject = await project(b, "B env project")
      const bEnv = await environment(b, bProject, "B env")
      const steal = await b.client.from("environment_variables").insert({
        project_id: bProject,
        environment_id: bEnv,
        name: "STOLEN",
        secret_reference_id: ref.data!.id,
      })
      expect(steal.error?.code).toBe("23503")

      // Deleting the reference keeps the variable and clears the link.
      expect(
        (await a.client.from("secret_references").delete().eq("id", ref.data!.id)).error,
      ).toBeNull()
      const after = await a.client
        .from("environment_variables")
        .select("secret_reference_id")
        .eq("id", v.data!.id)
        .single()
      expect(after.data?.secret_reference_id).toBeNull()

      // Activity keeps names only: no locator path.
      const ev = await a.client
        .from("activity_events")
        .select("event_type, summary, metadata")
        .in("event_type", ["secret_reference.added", "secret_reference.removed", "variable.added"])
      expect(ev.data?.length).toBeGreaterThan(0)
      expect(JSON.stringify(ev.data)).not.toContain("workplace/portal/prd")
    })
  })

  describe("app selects (composite-FK embeds)", () => {
    it("embeds projects, counts, services and environments", async () => {
      const p = await project(a, "Embeds env")
      const env = await environment(a, p, "Embed staging", { environment_type: "staging" })
      const svc = await service(p, "Embed Postgres")
      await a.client
        .from("service_instances")
        .insert({ project_id: p, project_service_id: svc, environment_id: env, status: "active" })
      await a.client.from("environment_variables").insert([
        { project_id: p, environment_id: env, name: "A_ONE" },
        { project_id: p, environment_id: env, name: "A_TWO" },
      ])

      const list = await a.client
        .from("environments")
        .select(ENVIRONMENT_LIST_SELECT)
        .eq("project_id", p)
      expect(list.error).toBeNull()
      expect(list.data?.[0]).toMatchObject({
        name: "Embed staging",
        project: { name: "Embeds env" },
        environment_variables: [{ count: 2 }],
        service_instances: [{ count: 1 }],
      })

      const detail = await a.client
        .from("environments")
        .select(ENVIRONMENT_DETAIL_SELECT)
        .eq("id", env)
        .single()
      expect(detail.data?.project?.id).toBe(p)

      const inst = await a.client
        .from("service_instances")
        .select(ENVIRONMENT_INSTANCES_SELECT)
        .eq("environment_id", env)
      expect(inst.data?.[0]?.service?.name).toBe("Embed Postgres")

      const services = await a.client
        .from("project_services")
        .select(SERVICE_LIST_SELECT)
        .eq("project_id", p)
      expect(services.error).toBeNull()
      expect(services.data?.[0]).toMatchObject({
        project: { name: "Embeds env" },
        instances: [
          { status: "active", environment: { name: "Embed staging", environment_type: "staging" } },
        ],
      })

      expect(
        (await b.client.from("project_services").select(SERVICE_LIST_SELECT).eq("project_id", p))
          .data,
      ).toEqual([])
    })
  })

  describe("lifecycle", () => {
    it("cascades on environment delete and links sessions within the project", async () => {
      const env = await environment(a, p1, "Doomed")
      const svc = await service(p1, "Cloudinary")
      await a.client
        .from("service_instances")
        .insert({ project_id: p1, project_service_id: svc, environment_id: env })
      await a.client
        .from("environment_variables")
        .insert({ project_id: p1, environment_id: env, name: "CLOUDINARY_URL" })

      // A work session can record an environment from its own project only.
      const task = await a.client
        .from("tasks")
        .insert({ project_id: p1, title: "Env session" })
        .select("id")
        .single()
      const session = await a.client.rpc("start_work_session", { p_task_id: task.data!.id })
      expect(session.error).toBeNull()
      const otherEnv = await environment(a, p2, "Not mine")
      expect(
        (
          await a.client
            .from("work_sessions")
            .update({ environment_id: otherEnv })
            .eq("id", session.data!)
        ).error?.code,
      ).toBe("23503")
      expect(
        (
          await a.client
            .from("work_sessions")
            .update({ environment_id: env })
            .eq("id", session.data!)
        ).error,
      ).toBeNull()
      await a.client.rpc("complete_work_session", { p_session_id: session.data! })

      expect((await a.client.from("environments").delete().eq("id", env)).error).toBeNull()
      expect(
        (await a.client.from("service_instances").select("id").eq("environment_id", env)).data,
      ).toEqual([])
      expect(
        (await a.client.from("environment_variables").select("id").eq("environment_id", env)).data,
      ).toEqual([])
      const s = await a.client
        .from("work_sessions")
        .select("environment_id")
        .eq("id", session.data!)
        .single()
      expect(s.data?.environment_id).toBeNull()

      const deleted = await a.client
        .from("activity_events")
        .select("summary")
        .eq("project_id", p1)
        .eq("event_type", "environment.deleted")
      expect(deleted.data?.map((e) => e.summary)).toContain("Deleted environment Doomed")
    })
  })
})

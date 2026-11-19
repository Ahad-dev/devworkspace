import { describe, expect, it } from "vitest"

import {
  optionalGitRemote,
  optionalUrl,
  projectCreateSchema,
  projectUpdateSchema,
  repositorySchema,
  technologySchema,
} from "@/features/projects/schemas"

const baseUpdate = {
  name: "Alpha",
  project_type: "client",
  status: "active",
  priority: "",
  description: "",
  start_date: "",
  target_date: "",
  project_url: "",
  documentation_url: "",
  notes: "",
}

describe("projectCreateSchema", () => {
  it("needs only a name and a type", () => {
    expect(projectCreateSchema.parse({ name: "  Alpha ", project_type: "personal" })).toEqual({
      name: "Alpha",
      project_type: "personal",
    })
    expect(projectCreateSchema.safeParse({ name: "", project_type: "personal" }).success).toBe(
      false,
    )
    expect(projectCreateSchema.safeParse({ name: "A", project_type: "secret" }).success).toBe(false)
  })
})

describe("projectUpdateSchema", () => {
  it("turns empty optional fields into null", () => {
    const parsed = projectUpdateSchema.parse(baseUpdate)
    expect(parsed).toMatchObject({
      priority: null,
      description: null,
      start_date: null,
      project_url: null,
      notes: null,
    })
  })

  it("allows status to be omitted (archived projects) but not set to archived", () => {
    const { status: _omit, ...withoutStatus } = baseUpdate
    expect(projectUpdateSchema.safeParse(withoutStatus).success).toBe(true)
    expect(projectUpdateSchema.safeParse({ ...baseUpdate, status: "archived" }).success).toBe(false)
  })

  it("rejects a target date before the start date", () => {
    const r = projectUpdateSchema.safeParse({
      ...baseUpdate,
      start_date: "2026-06-01",
      target_date: "2026-01-01",
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(["target_date"])
  })

  it("rejects secrets in free text", () => {
    const r = projectUpdateSchema.safeParse({ ...baseUpdate, notes: "prod key sk_live_51HxYzAbCd" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toMatch(/not secret values/)
  })
})

describe("optionalUrl", () => {
  it.each(["https://example.com", "http://localhost:3000/a?b=c#d"])("accepts %s", (u) => {
    expect(optionalUrl.safeParse(u).success).toBe(true)
  })
  it.each([
    "ftp://example.com",
    "javascript:alert(1)",
    "https://user:pw@example.com",
    "https://example.com/?token=abcdef12345",
  ])("rejects %s", (u) => {
    expect(optionalUrl.safeParse(u).success).toBe(false)
  })
})

describe("optionalGitRemote", () => {
  it.each([
    "https://github.com/acme/web",
    "https://dev.azure.com/org/project/_git/repo",
    "git@github.com:acme/api.git",
    "ssh://git@bitbucket.org:7999/team/repo.git",
  ])("accepts %s", (u) => {
    expect(optionalGitRemote.safeParse(u).success).toBe(true)
  })
  it.each([
    "https://token@github.com/acme/web",
    "https://u:p@gitlab.com/g/r.git",
    "http://github.com/acme/web",
    "github.com/acme/web",
  ])("rejects %s", (u) => {
    expect(optionalGitRemote.safeParse(u).success).toBe(false)
  })
})

describe("repositorySchema / technologySchema", () => {
  it("rejects branch names with spaces", () => {
    const r = repositorySchema.safeParse({
      name: "web",
      provider: "github",
      purpose: "frontend",
      remote_url: "",
      default_branch: "my branch",
      primary_language: "",
      local_path: "",
      readme_url: "",
      notes: "",
    })
    expect(r.success).toBe(false)
  })

  it("maps an empty repository link to null and validates the id", () => {
    expect(
      technologySchema.parse({
        name: "React",
        category: "frontend",
        version: "",
        repository_id: "",
      }),
    ).toEqual({ name: "React", category: "frontend", version: null, repository_id: null })
    expect(
      technologySchema.safeParse({
        name: "React",
        category: "frontend",
        version: "",
        repository_id: "not-a-uuid",
      }).success,
    ).toBe(false)
  })
})

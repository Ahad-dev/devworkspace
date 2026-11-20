import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 6 (Spec FR-10, FR-11, §9.3, §9.4; Plan P6.1–P6.3, P6.7): documents, task links,
 * attachments in the private bucket, and command snippets. Other users can't read, upload into
 * or sign the owner's files; disallowed types are refused; full-text search finds title and body.
 */
describe("knowledge base: documents, attachments and commands", () => {
  let a: TestUser
  let b: TestUser
  let p1: string
  let p2: string
  let repo1: string
  let repo2: string
  let env1: string
  const uploaded: string[] = []

  beforeAll(async () => {
    a = await createTestUser("p6a")
    b = await createTestUser("p6b")
    p1 = await insert(a, "projects", { name: "Knowledge one", project_type: "client" })
    p2 = await insert(a, "projects", { name: "Knowledge two", project_type: "client" })
    repo1 = await insert(a, "repositories", { project_id: p1, name: "web", provider: "github" })
    repo2 = await insert(a, "repositories", { project_id: p2, name: "api", provider: "github" })
    env1 = await insert(a, "environments", {
      project_id: p1,
      name: "Production",
      environment_type: "production",
    })
  })

  afterAll(async () => {
    if (uploaded.length) await adminClient().storage.from("attachments").remove(uploaded)
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  async function insert(user: TestUser, table: string, row: Record<string, unknown>) {
    const { data, error } = await user.client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(table as any)
      .insert(row)
      .select("id")
      .single()
    expect(error, `${table}: ${error?.message}`).toBeNull()
    return (data as unknown as { id: string }).id
  }

  describe("documents", () => {
    let globalDoc: string
    let projectDoc: string

    it("stores global and project documents with same-project links", async () => {
      globalDoc = await insert(a, "documents", {
        title: "Personal shell setup",
        category: "setup",
        content_markdown: "Install **zoxide** and starship.",
      })
      projectDoc = await insert(a, "documents", {
        project_id: p1,
        repository_id: repo1,
        environment_id: env1,
        title: "Production rollback runbook",
        category: "deployment",
        summary: "Promote the previous deployment",
        content_markdown:
          "Connect with `psql postgres://app:$PGPASSWORD@db:5432/app`, then run the rollback.",
      })
      expect(globalDoc && projectDoc).toBeTruthy()
    })

    it("refuses links across projects and links on global documents", async () => {
      const cross = await a.client
        .from("documents")
        .insert({ project_id: p1, repository_id: repo2, title: "Cross" })
      expect(cross.error?.code).toBe("23503")
      const global = await a.client
        .from("documents")
        .insert({ repository_id: repo1, title: "Loose" })
      expect(global.error?.code).toBe("23514")
    })

    it("refuses secret material but accepts placeholders", async () => {
      for (const content_markdown of [
        "Connect with postgres://app:hunter2@db:5432/app",
        "token ghp_abcdefghijklmnopqrstuvwxyz0123456789",
        "-----BEGIN PRIVATE KEY-----\nMIIE",
      ]) {
        const { error } = await a.client
          .from("documents")
          .insert({ title: "Leaky", content_markdown })
        expect(error?.code, content_markdown).toBe("23514")
      }
      const { error } = await a.client
        .from("documents")
        .insert({ title: "Fine", content_markdown: "DATABASE_URL=${DATABASE_URL} and <password>" })
      expect(error).toBeNull()
    })

    it("finds documents by title and body with full-text search", async () => {
      const byBody = await a.client
        .from("documents")
        .select("id")
        .textSearch("search_vector", "rollback", { type: "websearch", config: "english" })
      expect(byBody.data?.map((d) => d.id)).toContain(projectDoc)
      const byWord = await a.client
        .from("documents")
        .select("id")
        .textSearch("search_vector", "zoxide", { type: "websearch", config: "english" })
      expect(byWord.data?.map((d) => d.id)).toEqual([globalDoc])
      const byStem = await a.client
        .from("documents")
        .select("id")
        .textSearch("search_vector", "promoting deployments", {
          type: "websearch",
          config: "english",
        })
      expect(byStem.data?.map((d) => d.id)).toContain(projectDoc)
    })

    it("stamps the archive time on the server and records activity without content", async () => {
      const { data } = await a.client
        .from("documents")
        .update({ archived_at: "2000-01-01T00:00:00Z" })
        .eq("id", globalDoc)
        .select("archived_at")
        .single()
      expect(new Date(data!.archived_at!).getFullYear()).toBeGreaterThan(2000)

      // Several quick content saves fold into one "updated" entry.
      for (const n of [1, 2, 3]) {
        const { error } = await a.client
          .from("documents")
          .update({ content_markdown: `Step ${n}: promote the previous deployment.` })
          .eq("id", projectDoc)
        expect(error).toBeNull()
      }
      const { data: events } = await a.client
        .from("activity_events")
        .select("event_type, metadata")
        .in("event_type", ["document.created", "document.updated", "document.archived"])
      const forDoc = (events ?? []).filter(
        (e) => (e.metadata as { document_id?: string }).document_id === projectDoc,
      )
      expect(forDoc.filter((e) => e.event_type === "document.updated")).toHaveLength(1)
      expect(forDoc.some((e) => e.event_type === "document.created")).toBe(true)
      expect(events!.some((e) => e.event_type === "document.archived")).toBe(true)
      expect(JSON.stringify(events)).not.toMatch(/promote the previous|PGPASSWORD/)
    })

    it("links documents to the owner's tasks only", async () => {
      const task = await insert(a, "tasks", { project_id: p1, title: "Write the runbook" })
      const { error } = await a.client
        .from("task_document_links")
        .insert({ task_id: task, document_id: projectDoc })
      expect(error).toBeNull()

      const bDoc = await insert(b, "documents", { title: "B's notes" })
      const cross = await b.client
        .from("task_document_links")
        .insert({ task_id: task, document_id: bDoc })
      expect(cross.error?.code).toBe("23503")
    })

    it("keeps other users out", async () => {
      const read = await b.client.from("documents").select("id").in("id", [globalDoc, projectDoc])
      expect(read.data).toEqual([])
      const links = await b.client.from("task_document_links").select("task_id")
      expect(links.data).toEqual([])
      const intoA = await b.client.from("documents").insert({ project_id: p1, title: "Sneaky" })
      expect(intoA.error).not.toBeNull()
      const upd = await b.client
        .from("documents")
        .update({ title: "Owned" })
        .eq("id", projectDoc)
        .select("id")
      expect(upd.data ?? []).toEqual([])
      const ownerSpoof = await b.client.from("documents").insert({ owner_id: a.id, title: "Spoof" })
      expect(ownerSpoof.error?.code).toBe("42501")
    })
  })

  describe("attachments", () => {
    let doc: string
    let path: string
    let attachmentId: string

    beforeAll(async () => {
      doc = await insert(a, "documents", { project_id: p1, title: "Attachments doc" })
    })

    function register(user: TestUser, overrides: Record<string, unknown> = {}) {
      const p = `${user.id}/${doc}/${randomUUID()}-notes.txt`
      return {
        path: p,
        query: user.client
          .from("document_attachments")
          .insert({
            document_id: doc,
            storage_path: p,
            file_name: "notes.txt",
            mime_type: "text/plain",
            size_bytes: 5,
            ...overrides,
          })
          .select("id")
          .single(),
      }
    }

    it("uploads a registered file into the owner's folder and signs a download", async () => {
      const reg = register(a)
      const { data, error } = await reg.query
      expect(error).toBeNull()
      path = reg.path
      attachmentId = data!.id

      const up = await a.client.storage
        .from("attachments")
        .upload(path, new Blob(["hello"], { type: "text/plain" }), { contentType: "text/plain" })
      expect(up.error).toBeNull()
      uploaded.push(path)

      const signed = await a.client.storage
        .from("attachments")
        .createSignedUrl(path, 60, { download: "notes.txt" })
      expect(signed.error).toBeNull()
      const res = await fetch(signed.data!.signedUrl)
      expect(res.status).toBe(200)
      expect(res.headers.get("content-disposition") ?? "").toMatch(/attachment/)
      expect(await res.text()).toBe("hello")
    })

    it("refuses unregistered paths, other folders and overwrites", async () => {
      const unregistered = await a.client.storage
        .from("attachments")
        .upload(`${a.id}/${doc}/${randomUUID()}-loose.txt`, new Blob(["x"]), {
          contentType: "text/plain",
        })
      expect(unregistered.error).not.toBeNull()

      const overwrite = await a.client.storage
        .from("attachments")
        .upload(path, new Blob(["changed"]), { contentType: "text/plain", upsert: true })
      expect(overwrite.error).not.toBeNull()

      // A metadata row can't point outside the owner's and document's folder.
      const outside = register(a, { storage_path: `${b.id}/${doc}/${randomUUID()}-x.txt` })
      expect((await outside.query).error?.code).toBe("23514")
    })

    it("refuses disallowed types and sizes", async () => {
      const svg = register(a, { mime_type: "image/svg+xml" })
      expect((await svg.query).error?.code).toBe("23514")
      const big = register(a, { size_bytes: 10 * 1024 * 1024 + 1 })
      expect((await big.query).error?.code).toBe("23514")

      // A registered text file can't be uploaded as HTML: the bucket allowlist refuses it.
      const reg = register(a)
      expect((await reg.query).error).toBeNull()
      const html = await a.client.storage
        .from("attachments")
        .upload(reg.path, new Blob(["<script>alert(1)</script>"]), { contentType: "text/html" })
      expect(html.error).not.toBeNull()
    })

    it("keeps other users out of the owner's files", async () => {
      const rows = await b.client.from("document_attachments").select("id").eq("id", attachmentId)
      expect(rows.data).toEqual([])

      const signed = await b.client.storage.from("attachments").createSignedUrl(path, 60)
      expect(signed.data?.signedUrl ?? null).toBeNull()

      const download = await b.client.storage.from("attachments").download(path)
      expect(download.data).toBeNull()

      const list = await b.client.storage.from("attachments").list(`${a.id}/${doc}`)
      expect(list.data ?? []).toEqual([])

      // Uploading into A's folder fails even at a path A registered.
      const reg = register(a)
      expect((await reg.query).error).toBeNull()
      const intoA = await b.client.storage
        .from("attachments")
        .upload(reg.path, new Blob(["x"]), { contentType: "text/plain" })
      expect(intoA.error).not.toBeNull()

      // B registering a row against A's document fails (composite FK to the owner's document).
      const bRow = await b.client.from("document_attachments").insert({
        document_id: doc,
        storage_path: `${b.id}/${doc}/${randomUUID()}-x.txt`,
        file_name: "x.txt",
        mime_type: "text/plain",
        size_bytes: 1,
      })
      expect(bRow.error).not.toBeNull()

      await b.client.storage.from("attachments").remove([path])
      const still = await adminClient().storage.from("attachments").list(`${a.id}/${doc}`)
      expect(still.data?.map((o) => `${a.id}/${doc}/${o.name}`)).toContain(path)

      const anon = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/${path}`,
      )
      expect(anon.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("commands", () => {
    it("stores commands with shell, OS and environment, searchable by text", async () => {
      const id = await insert(a, "command_snippets", {
        project_id: p1,
        environment_id: env1,
        title: "Apply migrations",
        command_text: "pnpm db:push --yes",
        shell: "powershell",
        operating_system: "windows",
        category: "database",
        is_destructive: false,
      })
      const fts = await a.client
        .from("command_snippets")
        .select("id")
        .textSearch("search_vector", "migrations", { type: "websearch", config: "english" })
      expect(fts.data?.map((c) => c.id)).toContain(id)
      const sub = await a.client
        .from("command_snippets")
        .select("id")
        .ilike("command_text", "%db:push%")
      expect(sub.data?.map((c) => c.id)).toContain(id)

      const read = await b.client.from("command_snippets").select("id").eq("id", id)
      expect(read.data).toEqual([])
    })

    it("refuses secrets in command text and links on global commands", async () => {
      const secret = await a.client.from("command_snippets").insert({
        title: "Leaky",
        command_text: "curl -H 'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789'",
      })
      expect(secret.error?.code).toBe("23514")
      const placeholder = await a.client.from("command_snippets").insert({
        title: "Connect",
        command_text: 'psql "postgres://app:$PGPASSWORD@db:5432/app"',
      })
      expect(placeholder.error).toBeNull()
      const loose = await a.client
        .from("command_snippets")
        .insert({ title: "Loose", command_text: "ls", environment_id: env1 })
      expect(loose.error?.code).toBe("23514")
    })
  })
})

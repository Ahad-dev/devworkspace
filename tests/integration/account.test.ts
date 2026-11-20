import { randomUUID } from "node:crypto"

import { afterAll, describe, expect, it } from "vitest"

import { deleteAccountCompletely, listUserFiles } from "../../src/features/settings/account"
import { EXPORT_TABLES } from "../../src/features/settings/export"
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Plan P8.1; Spec §9.6, FR-14: export reads cover every table, and deleting an account removes
 * the user, every owned row and the stored files.
 */
describe("account export and deletion", () => {
  const cleanup: string[] = []
  afterAll(async () => {
    await Promise.allSettled(cleanup.map((id) => deleteTestUser(id)))
  })

  it("export reads every table the user owns, through RLS", async () => {
    const user = await createTestUser("export")
    cleanup.push(user.id)
    await user.client.from("projects").insert({ name: "Export me", project_type: "personal" })
    for (const { table, orderBy } of EXPORT_TABLES) {
      let q = user.client.from(table).select("*")
      for (const col of orderBy) q = q.order(col)
      const { error } = await q.range(0, 999)
      expect(error, `${table}: ${error?.message}`).toBeNull()
    }
    const { data } = await user.client.from("projects").select("name")
    expect(data).toEqual([{ name: "Export me" }])
  })

  it("deletes the user, their rows and their files", async () => {
    const user: TestUser = await createTestUser("delete")
    cleanup.push(user.id)
    const admin = adminClient()
    const { data: project } = await user.client
      .from("projects")
      .insert({ name: "Doomed", project_type: "personal" })
      .select("id")
      .single()
    const { data: doc } = await user.client
      .from("documents")
      .insert({ project_id: project!.id, title: "Doomed doc" })
      .select("id")
      .single()
    const path = `${user.id}/${doc!.id}/${randomUUID()}-notes.txt`
    const reg = await user.client.from("document_attachments").insert({
      document_id: doc!.id,
      storage_path: path,
      file_name: "notes.txt",
      mime_type: "text/plain",
      size_bytes: 5,
    })
    expect(reg.error).toBeNull()
    const up = await user.client.storage
      .from("attachments")
      .upload(path, new Blob(["hello"], { type: "text/plain" }), { contentType: "text/plain" })
    expect(up.error).toBeNull()
    expect(await listUserFiles(admin, user.id)).toEqual([path])

    expect(await deleteAccountCompletely(admin, user.id)).toBe(1)

    const { data: gone } = await admin.auth.admin.getUserById(user.id)
    expect(gone.user ?? null).toBeNull()
    for (const table of [
      "profiles",
      "projects",
      "documents",
      "document_attachments",
      "activity_events",
    ]) {
      const col = table === "profiles" ? "id" : "owner_id"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (admin as any).from(table).select("*").eq(col, user.id)
      expect(data, table).toEqual([])
    }
    expect(await listUserFiles(admin, user.id)).toEqual([])
  })
})

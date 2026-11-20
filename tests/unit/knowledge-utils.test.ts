import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Markdown } from "@/components/shared/markdown"
import {
  attachmentRequestSchema,
  commandSchema,
  documentUpdateSchema,
} from "@/features/knowledge/schemas"
import {
  attachmentStoragePath,
  attachmentTypeFor,
  destructiveReasons,
  displayFileName,
  formatBytes,
  ilikeTerm,
  sanitizeFileName,
} from "@/features/knowledge/utils"
import { looksLikeSecret } from "@/lib/security/secret-guard"

/** Phase 6 (Spec FR-10, FR-11, §9.4, §9.5; Plan P6.7): pure knowledge-base helpers. */

const md = (source: string) => renderToStaticMarkup(createElement(Markdown, null, source))

describe("Markdown rendering", () => {
  it("never renders raw HTML or script", () => {
    const html = md('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<b>bold</b>')
    expect(html).not.toMatch(/<script|onerror|<img|<b>/i)
  })

  it("drops javascript: and data: links", () => {
    const html = md("[click](javascript:alert(1)) and [data](data:text/html;base64,PHNjcmlwdD4=)")
    expect(html).not.toMatch(/javascript:|data:text/i)
    expect(html).toContain("click")
  })

  it("opens external links safely and shows images as links", () => {
    const html = md("[docs](https://example.com/docs)\n\n![diagram](https://example.com/a.png)")
    expect(html).toContain('href="https://example.com/docs"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(html).not.toContain("<img")
    expect(html).toContain("diagram")
  })

  it("renders GitHub-flavoured Markdown", () => {
    const html = md(
      "# Setup\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n\n```sh\npnpm install\n```",
    )
    expect(html).toContain("<h1")
    expect(html).toContain("<table>")
    expect(html).toContain('type="checkbox"')
    expect(html).toContain("<pre")
    expect(html).toContain("pnpm install")
  })
})

describe("attachments", () => {
  it("sanitizes file names for storage", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd")
    expect(sanitizeFileName("C:\\Users\\me\\Résumé final (v2).PDF")).toBe("Resume-final-v2.pdf")
    expect(sanitizeFileName("a<script>.png")).toBe("a-script.png")
    expect(sanitizeFileName("")).toBe("file")
    expect(sanitizeFileName("...")).toBe("file")
    const long = sanitizeFileName(`${"x".repeat(300)}.json`)
    expect(long.length).toBeLessThanOrEqual(120)
    expect(long.endsWith(".json")).toBe(true)
  })

  it("keeps a readable display name without paths or control characters", () => {
    expect(displayFileName("C:\\tmp\\Run book.md")).toBe("Run book.md")
    expect(displayFileName("bad\u0000name\u0007.txt")).toBe("badname.txt")
  })

  it("decides the type from an allowlisted extension", () => {
    expect(attachmentTypeFor("Guide.PDF")).toBe("application/pdf")
    expect(attachmentTypeFor("shot.JPG")).toBe("image/jpeg")
    expect(attachmentTypeFor("notes.md")).toBe("text/markdown")
    expect(attachmentTypeFor("logo.svg")).toBeNull()
    expect(attachmentTypeFor("page.html")).toBeNull()
    expect(attachmentTypeFor(".env")).toBeNull()
    expect(attachmentTypeFor("id_rsa")).toBeNull()
    expect(attachmentTypeFor("key.pem")).toBeNull()
  })

  it("builds paths the database accepts", () => {
    const owner = "0b6a1f3e-8d43-4c3e-9a51-6b8e2f0c1d2a"
    const doc = "5d1c9e7a-2b3f-4a6d-8e9f-0a1b2c3d4e5f"
    const obj = "9f8e7d6c-5b4a-4321-8fed-cba987654321"
    const path = attachmentStoragePath(owner, doc, obj, "My Notes (final).md")
    expect(path).toBe(`${owner}/${doc}/${obj}-My-Notes-final.md`)
    expect(path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,120}$/)
  })

  it("validates upload requests", () => {
    const base = { document_id: "5d1c9e7a-2b3f-4a6d-8e9f-0a1b2c3d4e5f", size_bytes: 2048 }
    expect(attachmentRequestSchema.parse({ ...base, file_name: "Runbook.pdf" })).toMatchObject({
      file_name: "Runbook.pdf",
      mime_type: "application/pdf",
    })
    expect(attachmentRequestSchema.safeParse({ ...base, file_name: "x.svg" }).success).toBe(false)
    expect(
      attachmentRequestSchema.safeParse({
        ...base,
        file_name: "x.png",
        size_bytes: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false)
    expect(
      attachmentRequestSchema.safeParse({ ...base, file_name: "x.txt", size_bytes: 0 }).success,
    ).toBe(false)
  })

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2 KB")
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB")
  })
})

describe("destructiveReasons", () => {
  it("flags commands that delete or overwrite", () => {
    expect(destructiveReasons("rm -rf node_modules")).toEqual(["rm -r / -f deletes files"])
    expect(destructiveReasons("Remove-Item .next -Recurse -Force")).toHaveLength(1)
    expect(destructiveReasons("psql -c 'DROP TABLE users'")).toEqual(["DROP"])
    expect(destructiveReasons("TRUNCATE sessions")).toEqual(["TRUNCATE"])
    expect(destructiveReasons("pnpm exec supabase db reset --linked")).toEqual([
      "resets a database",
    ])
    expect(destructiveReasons("git push --force origin main")).toEqual(["force push"])
    expect(destructiveReasons("git reset --hard origin/main")).toEqual(["git reset --hard"])
    expect(destructiveReasons("terraform destroy")).toEqual(["terraform destroy"])
  })

  it("leaves everyday commands alone", () => {
    for (const cmd of [
      "pnpm install",
      "pnpm format src",
      "pnpm db:push --yes",
      "git push",
      "ls -la",
    ]) {
      expect(destructiveReasons(cmd), cmd).toEqual([])
    }
    expect(destructiveReasons("pnpm install --force")).toEqual(["--force skips safety checks"])
  })
})

describe("placeholders are not secrets", () => {
  it("accepts placeholders in a URL's password slot and refuses literal passwords", () => {
    for (const ok of [
      "postgres://app:$PGPASSWORD@db:5432/app",
      "postgres://app:${DB_PASSWORD}@db:5432/app",
      "postgres://app:<password>@localhost/app",
      "redis://default:****@cache:6379",
      "psql $DATABASE_URL",
    ]) {
      expect(looksLikeSecret(ok), ok).toBe(false)
    }
    expect(looksLikeSecret("postgres://app:hunter2@db:5432/app")).toBe(true)
  })
})

describe("knowledge schemas", () => {
  const doc = {
    title: "Local setup",
    category: "setup",
    summary: "",
    content_markdown: "Run `psql $DATABASE_URL`",
    project_id: "",
    repository_id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
    environment_id: "",
  }

  it("drops repository and environment links from a global document", () => {
    expect(documentUpdateSchema.parse(doc)).toMatchObject({
      project_id: null,
      repository_id: null,
      environment_id: null,
      summary: null,
    })
  })

  it("refuses literal secrets in content", () => {
    expect(
      documentUpdateSchema.safeParse({
        ...doc,
        content_markdown: "key: sk_live_51HxYzAbCdEfGhIjKl",
      }).success,
    ).toBe(false)
    expect(documentUpdateSchema.safeParse({ ...doc, title: "  " }).success).toBe(false)
  })

  it("validates commands", () => {
    const cmd = {
      title: "Apply migrations",
      command_text: "pnpm db:push --yes\n\n",
      description: "",
      shell: "powershell",
      operating_system: "windows",
      category: "database",
      prerequisites: "",
      is_destructive: false,
      project_id: "",
      repository_id: "",
      environment_id: "",
    }
    expect(commandSchema.parse(cmd)).toMatchObject({ command_text: "pnpm db:push --yes" })
    expect(
      commandSchema.safeParse({
        ...cmd,
        command_text: "export GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwx",
      }).success,
    ).toBe(false)
    expect(commandSchema.safeParse({ ...cmd, shell: "fish" }).success).toBe(false)
  })

  it("escapes search terms for PostgREST filters", () => {
    expect(ilikeTerm("50%_off")).toBe("50\\%\\_off")
    expect(ilikeTerm("a,b(c)")).toBe("a b c")
  })
})

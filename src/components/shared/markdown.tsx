import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { ImageIcon } from "lucide-react"

import { CopyButton } from "@/components/shared/copy-button"
import { cn } from "@/lib/utils"

/**
 * The one way Markdown is rendered (Spec §9.5; Plan §5): GitHub-flavoured Markdown, raw HTML is
 * never rendered (no rehype-raw), the result is sanitized, and only http(s)/mailto links and
 * in-page anchors survive. Images aren't loaded from other sites; they show as links.
 */

type HastNode = { type: string; value?: string; children?: HastNode[] }

function textOf(node: HastNode | undefined): string {
  if (!node) return ""
  if (node.type === "text") return node.value ?? ""
  return (node.children ?? []).map(textOf).join("")
}

const SAFE_LINK = /^(https?:|mailto:|#)/i

function urlTransform(url: string) {
  const safe = defaultUrlTransform(url)
  return SAFE_LINK.test(safe) ? safe : ""
}

const components: Components = {
  // Only href, title and id are passed through; footnote anchors keep their ids.
  a({ href, children, title, id }) {
    if (!href) return <span>{children}</span>
    if (href.startsWith("#")) {
      return (
        <a href={href} title={title} id={id}>
          {children}
        </a>
      )
    }
    return (
      <a href={href} title={title} id={id} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    )
  },
  img({ src, alt }) {
    const label = alt?.trim() || "image"
    if (typeof src !== "string" || !src) return <span>[{label}]</span>
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1"
      >
        <ImageIcon className="size-3.5" aria-hidden />
        {label}
      </a>
    )
  },
  pre({ children, node }) {
    const text = textOf(node as HastNode | undefined).replace(/\n$/, "")
    return (
      <div className="group relative">
        {/* Room on the right so the copy button never covers the code. */}
        <pre className="pr-11">{children}</pre>
        {text ? (
          <CopyButton
            text={text}
            label="Copy code"
            className="absolute top-1.5 right-1.5 bg-background/80 opacity-70 group-hover:opacity-100 focus-visible:opacity-100"
          />
        ) : null}
      </div>
    )
  },
  table({ children }) {
    return <table>{children}</table>
  },
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={urlTransform}
        skipHtml
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

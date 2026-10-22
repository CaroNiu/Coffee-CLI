/** File types that Coffee CLI can render as a read-only document. Keep this
 *  deliberately narrow: `.mdx` can contain executable JSX and is not plain
 *  Markdown, so it should not be presented as a safe Markdown preview. */
export function isMarkdownFile(filePath: string): boolean {
  return /\.(md|markdown)$/i.test(filePath);
}

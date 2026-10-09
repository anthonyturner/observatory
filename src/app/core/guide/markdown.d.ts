/** A Markdown file imported `with { loader: 'text' }`, which the build turns into its text. */
declare module '*.md' {
  const text: string;
  export default text;
}

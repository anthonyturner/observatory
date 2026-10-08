/** Files the build inlines as text: the layout worker's source. */
declare module '*.min.js' {
  const source: string;
  export default source;
}

/** Stylesheets the build bundles into the page; importing one is only for its effect. */
declare module '*.css';

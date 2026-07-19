declare const __BUILD_ID__: string;

declare module "*.css?inline" {
  const css: string;
  export default css;
}

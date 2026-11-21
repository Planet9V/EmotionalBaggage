// occt-import-js ships no types. The shape used is declared where it is used (src/lib/geometry/meshFile.ts).
declare module "occt-import-js" {
  const factory: (options?: { locateFile?: (name: string) => string }) => Promise<unknown>;
  export default factory;
}

declare module "sharp" {
  type SharpInput = ArrayBuffer | Uint8Array;

  interface SharpPipeline {
    png(): SharpPipeline;
    toBuffer(): Promise<Buffer>;
  }

  interface SharpFactory {
    (input: SharpInput): SharpPipeline;
  }

  const sharp: SharpFactory;
  export default sharp;
}

import { Novu } from "@novu/api";
import type { CreateNovuSdkClientOptions } from "../../src/novu-sdk-client";

export function createBootstrapNovuClient(options: CreateNovuSdkClientOptions): Novu {
  return new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });
}

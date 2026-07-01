import { Novu } from "@novu/api";
import type { CreateNovuSdkClientOptions } from "@edaya/adaptor-novu";

export function createBootstrapNovuClient(options: CreateNovuSdkClientOptions): Novu {
  return new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });
}

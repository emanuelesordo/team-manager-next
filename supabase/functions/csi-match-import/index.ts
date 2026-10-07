import { csiHandler } from "../_shared/csi-handler.ts";
Deno.serve(csiHandler("import"));

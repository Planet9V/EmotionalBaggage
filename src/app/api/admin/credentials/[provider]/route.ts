import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { checkCredentialFields, providerView, saveCredentials } from "@/lib/admin/credentials";
import { credentialsPut, invalid } from "@/lib/admin/schemas";
import { isModelProvider } from "@/lib/secretOrigin";

type Ctx = { params: Promise<{ provider: string }> };

/** { fields: { name: value }, address? }. Absent or empty fields are left as they are; values are trimmed. Saved values are bound to `address` (model hosts) or the address in use. */
export const PUT = adminRoute(async (req: Request, { params }: Ctx) => {
  const { provider } = await params;
  const b = await body(req, credentialsPut);
  const { def, values } = checkCredentialFields(provider, b.fields);
  if (b.address && !isModelProvider(def.id)) throw invalid(["address"], `applies to the model hosts only; ${def.label} keys go to its own address`);
  await saveCredentials(def, values, b.address);
  return NextResponse.json({ provider: await providerView(def.id) });
});

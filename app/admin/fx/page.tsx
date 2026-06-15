import type { Metadata } from "next";
import { FxClient } from "./fx-client";

export const metadata: Metadata = { title: "FX & Currency — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <FxClient />;
}

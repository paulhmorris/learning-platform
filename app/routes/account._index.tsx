import { redirect } from "@vercel/remix";

export function loader() {
  throw redirect("/account/profile");
}

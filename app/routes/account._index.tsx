import { redirect } from "remix-typedjson";

export function loader() {
  throw redirect("/account/profile");
}

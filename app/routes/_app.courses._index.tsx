import { redirect } from "remix-typedjson";

// TODO: Update when more courses are available
export const loader = () => redirect("/courses/driver-safety-course");

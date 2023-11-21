import { json } from "@remix-run/node";

export async function loader() {
  const res = await fetch("http://127.0.0.1:1337/api/courses", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
    },
  });

  const data = (await res.json()) as unknown;
  return json(data);
}

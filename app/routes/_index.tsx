import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "LearnIt" }];

export default function Index() {
  return (
    <main className="relative min-h-screen bg-white sm:flex sm:items-center sm:justify-center">
      <h1>Hello</h1>
    </main>
  );
}

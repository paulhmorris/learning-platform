import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "LearnIt" }];

export default function Index() {
  return (
    <main className="p-24">
      <ul className="flex flex-col gap-4">
        <Link to="/courses">Courses</Link>
        <Link to="/courses/driver-safety-course">Course 1</Link>
        <Link to="/login">Login</Link>
        <Link to="/join">Join</Link>
        <Link to="/account">Account</Link>
      </ul>
      <div className="mt-12">
        <form action="/logout" method="post">
          <button>Logout</button>
        </form>
      </div>
    </main>
  );
}

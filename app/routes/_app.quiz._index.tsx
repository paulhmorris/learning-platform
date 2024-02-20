import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { cms } from "~/integrations/cms.server";

export async function loader() {
  try {
    const quiz = await cms.findOne("quizzes", 1, {
      fields: ["uuid"],
      populate: {
        questions: {
          populate: "answers",
        },
      },
    });
    return typedjson({ quiz });
  } catch (e) {
    console.error(e);
    return typedjson({ quiz: null });
  }
}

export default function Test() {
  const { quiz } = useTypedLoaderData<typeof loader>();
  return (
    <div className="grid grid-cols-3 gap-8">
      <pre className="col-span-1 max-w-2xl whitespace-pre-wrap rounded border-gray-500 bg-gray-50 p-6 text-xs">
        {JSON.stringify(quiz, null, 2)}
      </pre>
      <div className="col-span-2 h-full w-full bg-gray-50"></div>
    </div>
  );
}

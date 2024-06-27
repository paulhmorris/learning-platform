import { cms } from "~/integrations/cms.server";
import { APIResponseCollection } from "~/types/utils";

export async function getQuizzes() {
  return cms.find<APIResponseCollection<"api::quiz.quiz">["data"]>("quizzes", {
    fields: ["title", "passing_score", "uuid"],
  });
}

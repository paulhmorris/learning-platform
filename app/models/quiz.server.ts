import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { APIResponseCollection } from "~/types/utils";

export async function getQuizzes() {
  return cms.find<APIResponseCollection<"api::quiz.quiz">["data"]>("quizzes", {
    fields: ["title", "passing_score", "uuid"],
  });
}

export async function getAllQuizProgress(userId: string) {
  return db.userQuizProgress.findMany({ where: { userId } });
}

export async function resetAllQuizProgress(userId: string) {
  return db.userQuizProgress.deleteMany({ where: { userId } });
}

export async function resetQuizProgress(quizId: number, userId: string) {
  return db.userQuizProgress.delete({
    where: {
      userId_quizId: {
        quizId,
        userId,
      },
    },
  });
}

export async function updateQuizProgress(data: {
  quizId: number;
  userId: string;
  score: number;
  passingScore: number;
}) {
  const lesson = await db.userQuizProgress.upsert({
    where: {
      userId_quizId: {
        quizId: data.quizId,
        userId: data.userId,
      },
    },
    create: {
      quizId: data.quizId,
      userId: data.userId,
      score: data.score,
      isCompleted: data.score >= data.passingScore,
    },
    update: {
      score: data.score,
      isCompleted: data.score >= data.passingScore,
    },
  });
  return lesson;
}

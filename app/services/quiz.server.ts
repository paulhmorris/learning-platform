import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { APIResponseCollection } from "~/types/utils";

class Service {
  async getAll() {
    return cms.find<APIResponseCollection<"api::quiz.quiz">["data"]>("quizzes", {
      fields: ["title", "passing_score", "uuid"],
    });
  }

  async getAllQuizProgress(userId: string) {
    return db.userQuizProgress.findMany({ where: { userId } });
  }

  async resetAllQuizProgress(userId: string) {
    return db.userQuizProgress.deleteMany({ where: { userId } });
  }

  async resetQuizProgress(quizId: number, userId: string) {
    return db.userQuizProgress.delete({
      where: {
        userId_quizId: {
          quizId,
          userId,
        },
      },
    });
  }

  async updateQuizProgress(data: { quizId: number; userId: string; score: number; passingScore: number }) {
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
}

export const QuizService = new Service();

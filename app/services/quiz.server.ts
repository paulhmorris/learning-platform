import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { APIResponseCollection } from "~/types/utils";

const logger = createLogger("QuizService");

export const QuizService = {
  async getAll() {
    try {
      return cms.find<APIResponseCollection<"api::quiz.quiz">["data"]>("quizzes", {
        fields: ["title", "passing_score", "uuid"],
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get all quizzes", { error });
      throw error;
    }
  },

  async getAllQuizProgress(userId: string) {
    try {
      return await db.userQuizProgress.findMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get all quiz progress", { error });
      throw error;
    }
  },

  async resetAllQuizProgress(userId: string) {
    try {
      return await db.userQuizProgress.deleteMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to reset all quiz progress", { error });
      throw error;
    }
  },

  async resetQuizProgress(quizId: number, userId: string) {
    try {
      return db.userQuizProgress.delete({
        where: {
          userId_quizId: {
            quizId,
            userId,
          },
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to reset quiz progress", { error });
      throw error;
    }
  },

  async updateQuizProgress(data: { quizId: number; userId: string; score: number; passingScore: number }) {
    try {
      const quizProgress = await db.userQuizProgress.upsert({
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
      return quizProgress;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to update quiz progress", { error });
      throw error;
    }
  },
};

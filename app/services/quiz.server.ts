import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { APIResponseCollection, APIResponseData } from "~/types/utils";

const logger = createLogger("QuizService");

export const QuizService = {
  async getById(quizId: string | number) {
    try {
      return cms.findOne<APIResponseData<"api::quiz.quiz">>("quizzes", quizId, {
        populate: {
          questions: {
            fields: "*",
            populate: {
              answers: {
                fields: ["answer", "id", "required_duration_in_seconds"],
              },
            },
          },
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get quiz by ID ${quizId}`, { error });
      throw error;
    }
  },

  async getCorrectAnswers(quizId: string | number) {
    try {
      return cms.findOne<APIResponseData<"api::quiz.quiz">>("quizzes", quizId, {
        populate: {
          questions: {
            fields: ["question_type"],
            populate: {
              answers: {
                fields: ["is_correct"],
              },
            },
          },
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get correct answers for quiz ${quizId}`, { error });
      throw error;
    }
  },

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

  async resetAllProgress(userId: string) {
    try {
      return await db.userQuizProgress.deleteMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to reset all quiz progress", { error });
      throw error;
    }
  },

  async resetProgress(quizId: number, userId: string) {
    try {
      return db.userQuizProgress.delete({ where: { userId_quizId: { quizId, userId } } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to reset quiz ${quizId} progress for user ${userId}`, { error });
      throw error;
    }
  },

  async updateProgress(data: { quizId: number; userId: string; score: number; passingScore: number }) {
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

  async markAsPassed(quizId: number, userId: string, score: number) {
    try {
      return db.userQuizProgress.upsert({
        where: { userId_quizId: { quizId, userId } },
        create: { quizId, userId, score, isCompleted: true },
        update: { score, isCompleted: true },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to mark quiz ${quizId} as passed for user ${userId}`, { error });
      throw error;
    }
  },
};

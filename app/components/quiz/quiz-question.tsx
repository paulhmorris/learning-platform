import { QuizAnswer } from "~/components/quiz/quiz-answer";

type Props = {
  question: string;
  questionIndex: number;
  answers?: Array<{
    answer: string;
    is_correct: boolean;
  }>;
};

export function QuizQuestion({ question, questionIndex, answers }: Props) {
  if (!answers?.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-[32px] font-bold leading-tight">{question}</h2>
      <ul className="flex flex-col gap-2">
        {answers.map(({ answer }, a_index) => {
          if (!answer) {
            return null;
          }

          return (
            <QuizAnswer
              key={`question-${questionIndex}-answer-${a_index}`}
              questionIndex={questionIndex}
              answerIndex={a_index}
              answer={answer}
            />
          );
        })}
      </ul>
    </div>
  );
}

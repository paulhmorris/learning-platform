import { useId } from "react";

type Props = {
  questionIndex: number;
  answerIndex: number;
  answer: string;
};

export function QuizAnswer({ questionIndex, answerIndex, answer }: Props) {
  const inputId = useId();

  return (
    <li className="flex items-center gap-2">
      <input
        required
        id={inputId}
        type="radio"
        name={`question-${questionIndex}`}
        value={answerIndex}
        className="size-6 cursor-pointer border-2 !border-foreground text-foreground focus:ring-offset-background disabled:cursor-not-allowed dark:text-black"
      />
      <label htmlFor={inputId} className="cursor-pointer text-lg font-medium">
        {answer}
      </label>
    </li>
  );
}

"use client";

import { useActionState } from "react";
import { submitQuiz } from "@/app/access/[token]/course/[productId]/actions";
import type { QuizQuestion } from "@/lib/db/schema";
import { storeButtonClass, storeButtonStyle } from "./store-styles";

/** Answers are graded on the server; the correct answers are never sent to the browser. */
export function QuizForm({ token, productId, lessonId, questions, passPercent }: { token: string; productId: string; lessonId: string; questions: Omit<QuizQuestion, "answerIndex">[]; passPercent: number }) {
  const [state, action, pending] = useActionState(submitQuiz, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      {questions.map((q, i) => (
        <fieldset key={i}>
          <legend className="mb-2 font-semibold">
            {i + 1}. {q.question}
          </legend>
          <div className="space-y-1.5">
            {q.options.map((o, j) => (
              <label key={j} className="flex cursor-pointer items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm">
                <input type="radio" name={`q${i}`} value={j} required />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className={storeButtonClass} style={storeButtonStyle}>
        {pending ? "Checking…" : `Submit answers (pass mark ${passPercent}%)`}
      </button>
    </form>
  );
}

import { describe, expect, it } from "vitest";
import { courseProgress, gradeQuiz, parseQuizText, quizToText } from "@/lib/courses";

describe("quizzes", () => {
  const text = "Q: 2 + 2?\n- 3\n* 4\n- 5\n\nQ: Sky color?\n* Blue\n- Green";
  it("parses and round-trips the editor format", () => {
    const quiz = parseQuizText(text);
    expect(quiz).toHaveLength(2);
    expect(quiz[0]).toEqual({ question: "2 + 2?", options: ["3", "4", "5"], answerIndex: 1 });
    expect(parseQuizText(quizToText(quiz))).toEqual(quiz);
  });
  it("drops questions without a marked answer", () => {
    expect(parseQuizText("Q: no answer\n- a\n- b")).toHaveLength(0);
  });
  it("grades answers", () => {
    const quiz = parseQuizText(text);
    expect(gradeQuiz(quiz, [1, 0]).score).toBe(100);
    expect(gradeQuiz(quiz, [0, 0]).score).toBe(50);
  });
  it("computes progress", () => {
    expect(courseProgress(["a", "b", "c", "d"], new Set(["a", "c"]))).toBe(50);
  });
});

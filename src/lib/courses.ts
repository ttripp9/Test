import type { QuizQuestion } from "./db/schema";

export function gradeQuiz(quiz: QuizQuestion[], answers: (number | null)[]): { score: number; correct: number; total: number } {
  const total = quiz.length;
  if (total === 0) return { score: 100, correct: 0, total: 0 };
  const correct = quiz.reduce((n, q, i) => n + (answers[i] === q.answerIndex ? 1 : 0), 0);
  return { score: Math.round((correct / total) * 100), correct, total };
}

/**
 * Parse the quiz editor text format:
 *   Q: What is 2 + 2?
 *   - 3
 *   * 4        <- the correct answer starts with "*"
 *   - 5
 */
export function parseQuizText(text: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let current: QuizQuestion | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const q = /^Q[:.)]\s*(.+)$/i.exec(line);
    if (q) {
      if (current && current.options.length >= 2 && current.answerIndex >= 0) questions.push(current);
      current = { question: q[1].slice(0, 500), options: [], answerIndex: -1 };
      continue;
    }
    const opt = /^([-*])\s+(.+)$/.exec(line);
    if (opt && current && current.options.length < 8) {
      if (opt[1] === "*") current.answerIndex = current.options.length;
      current.options.push(opt[2].slice(0, 300));
    }
  }
  if (current && current.options.length >= 2 && current.answerIndex >= 0) questions.push(current);
  return questions.slice(0, 50);
}

export function quizToText(quiz: QuizQuestion[] | null | undefined): string {
  if (!quiz?.length) return "";
  return quiz
    .map((q) => [`Q: ${q.question}`, ...q.options.map((o, i) => `${i === q.answerIndex ? "*" : "-"} ${o}`)].join("\n"))
    .join("\n\n");
}

export function courseProgress(lessonIds: string[], completed: Set<string>): number {
  if (lessonIds.length === 0) return 0;
  const done = lessonIds.filter((id) => completed.has(id)).length;
  return Math.round((done / lessonIds.length) * 100);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { accessibleProduct, courseState } from "@/lib/access";
import { gradeQuiz } from "@/lib/courses";
import { db } from "@/lib/db";
import { lessonProgress } from "@/lib/db/schema";

async function lessonFor(form: FormData) {
  const token = String(form.get("token") ?? "");
  const productId = String(form.get("productId") ?? "");
  const lessonId = String(form.get("lessonId") ?? "");
  const access = await accessibleProduct(token, productId);
  if (!access || access.product.type !== "course") throw new Error("No access");
  const state = await courseState(access.order.id, productId);
  const lesson = state.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error("No such lesson");
  return { token, productId, access, state, lesson };
}

function nextUrl(token: string, productId: string, lessons: { id: string }[], currentId: string) {
  const i = lessons.findIndex((l) => l.id === currentId);
  const next = lessons[i + 1];
  return `/access/${token}/course/${productId}${next ? `?l=${next.id}` : "?done=1"}`;
}

export async function completeLesson(form: FormData) {
  const { token, productId, access, state, lesson } = await lessonFor(form);
  if (lesson.quiz?.length) throw new Error("Pass the quiz to complete this lesson.");
  await db
    .insert(lessonProgress)
    .values({ orderId: access.order.id, lessonId: lesson.id, completedAt: new Date() })
    .onConflictDoUpdate({ target: [lessonProgress.orderId, lessonProgress.lessonId], set: { completedAt: new Date() } })
    .run();
  revalidatePath(`/access/${token}`);
  redirect(nextUrl(token, productId, state.lessons, lesson.id));
}

export async function submitQuiz(_: FormState, form: FormData): Promise<FormState> {
  const { token, productId, access, state, lesson } = await lessonFor(form);
  const quiz = lesson.quiz ?? [];
  const answers = quiz.map((_q, i) => {
    const v = form.get(`q${i}`);
    return v == null ? null : Number(v);
  });
  if (answers.some((a) => a == null)) return { error: "Answer every question first." };
  const { score, correct, total } = gradeQuiz(quiz, answers);
  const passed = score >= lesson.passPercent;
  const existing = state.progress.find((p) => p.lessonId === lesson.id);
  await db
    .insert(lessonProgress)
    .values({ orderId: access.order.id, lessonId: lesson.id, quizScore: score, completedAt: passed ? new Date() : null })
    .onConflictDoUpdate({
      target: [lessonProgress.orderId, lessonProgress.lessonId],
      set: { quizScore: Math.max(score, existing?.quizScore ?? 0), completedAt: passed ? new Date() : (existing?.completedAt ?? null) },
    })
    .run();
  if (!passed) return { error: `You got ${correct} of ${total} (${score}%). You need ${lesson.passPercent}% — have another go!` };
  revalidatePath(`/access/${token}`);
  redirect(nextUrl(token, productId, state.lessons, lesson.id));
}

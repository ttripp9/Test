import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizForm } from "@/components/quiz-form";
import { StoreShell, storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "@/components/store-shell";
import { accessibleProduct, courseState } from "@/lib/access";
import { renderMarkdown, videoEmbedUrl } from "@/lib/safe";
import { completeLesson } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ token: string; productId: string }>; searchParams: Promise<{ l?: string; done?: string }> }) {
  const { token, productId } = await params;
  const { l, done } = await searchParams;
  const access = await accessibleProduct(token, productId);
  if (!access || access.product.type !== "course") notFound();
  const state = await courseState(access.order.id, productId);
  const { store, product } = access;
  const firstOpen = state.lessons.find((x) => !state.done.has(x.id)) ?? state.lessons[0];
  const lesson = state.lessons.find((x) => x.id === l) ?? firstOpen;
  const modules = [...new Set(state.lessons.map((x) => x.module))];
  const video = videoEmbedUrl(lesson?.videoUrl);

  return (
    <StoreShell store={store} showBranding={false} compactHeader>
      <Link href={`/access/${token}`} className="mb-3 inline-block text-sm opacity-70 hover:underline">← Library</Link>
      <h1 className="text-2xl font-bold">{product.title}</h1>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
        <div className="h-full" style={{ width: `${state.percent}%`, background: "var(--accent)" }} />
      </div>
      <p className="mt-1 text-xs opacity-70">{state.percent}% complete</p>

      {done && state.percent === 100 && (
        <div className={`${storeCardClass} mt-4 p-5 text-center`} style={storeCardStyle}>
          <div className="text-4xl">🏆</div>
          <p className="mt-1 font-bold">You finished the course!</p>
          <Link href={`/access/${token}/certificate/${productId}`} className={`${storeButtonClass} mt-3`} style={storeButtonStyle}>Get your certificate</Link>
        </div>
      )}

      {!lesson ? (
        <p className="mt-6 text-sm opacity-70">Lessons are coming soon.</p>
      ) : (
        <article className={`${storeCardClass} mt-5 overflow-hidden`} style={storeCardStyle}>
          {video && (
            <div className="aspect-video w-full bg-black">
              <iframe src={video} title={lesson.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          )}
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{lesson.module}</p>
            <h2 className="mt-1 text-xl font-bold">{lesson.title}</h2>
            {lesson.content && <div className="rich mt-3 text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }} />}
            {!video && lesson.videoUrl && (
              <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">Watch the video ↗</a>
            )}
            <div className="mt-6 border-t border-black/5 pt-5">
              {lesson.quiz?.length ? (
                state.done.has(lesson.id) ? (
                  <p className="text-sm font-medium">✅ Quiz passed</p>
                ) : (
                  <QuizForm token={token} productId={productId} lessonId={lesson.id} passPercent={lesson.passPercent} questions={lesson.quiz.map(({ question, options }) => ({ question, options }))} />
                )
              ) : state.done.has(lesson.id) ? (
                <p className="text-sm font-medium">✅ Completed</p>
              ) : (
                <form action={completeLesson}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <button className={storeButtonClass} style={storeButtonStyle}>Mark complete & continue</button>
                </form>
              )}
            </div>
          </div>
        </article>
      )}

      <nav className="mt-6 space-y-4">
        {modules.map((m) => (
          <div key={m}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{m}</h3>
            <ul className={`${storeCardClass} divide-y divide-black/5`} style={storeCardStyle}>
              {state.lessons.filter((x) => x.module === m).map((x) => (
                <li key={x.id}>
                  <Link href={`/access/${token}/course/${productId}?l=${x.id}`} className={`flex items-center gap-3 px-4 py-3 text-sm ${x.id === lesson?.id ? "font-semibold" : ""}`}>
                    <span aria-hidden>{state.done.has(x.id) ? "✅" : x.id === lesson?.id ? "▶️" : "○"}</span>
                    <span className="flex-1">{x.title}</span>
                    {x.quiz?.length ? <span className="text-xs opacity-60">Quiz</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </StoreShell>
  );
}

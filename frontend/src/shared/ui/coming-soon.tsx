import { CARD } from "./card";

/** 아직 만들지 않은 화면. 탭이 404로 끊기지 않게 자리만 잡아둔다 */
export function ComingSoon({ title, when }: { title: string; when: string }) {
  return (
    <div className={`mt-4 lg:m-5 lg:min-h-[calc(100dvh-40px)] ${CARD} lg:p-8`}>
      <h1 className="text-[34px] font-light tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[15px] text-text-secondary">{when}에 만들 화면이에요.</p>
    </div>
  );
}

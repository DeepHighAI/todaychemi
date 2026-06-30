// 미니앱은 Tailwind 를 쓰지 않는다(스타일은 src/styles/tokens.css 순수 CSS + 인라인).
// 루트 Next.js 앱의 postcss.config.mjs(@tailwindcss/postcss)가 상위 디렉토리 탐색으로
// 잡히면 미니앱 빌드가 루트 전용 의존성에 결합돼 깨지므로, 빈 PostCSS 설정으로 격리한다.
export default { plugins: {} };

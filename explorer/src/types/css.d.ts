// css.d.ts — khai báo module cho import "*.css" (side-effect import, không có type
// declaration thật) để tsc không báo lỗi "Cannot find module" ở các file import stylesheet
// (vd main.tsx: import "./styles.css").
declare module "*.css";

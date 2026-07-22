import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Explorer bundle nạp trực tiếp mã nguồn TS của core qua alias -> không cần build core.
// @core trỏ vào THƯ MỤC core/src (không phải 1 file barrel) -> mọi import phải chỉ rõ
// đúng file, vd '@core/chain/chain', không có '@core' barrel để import gọn.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("../core/src", import.meta.url)),
    },
  },
});

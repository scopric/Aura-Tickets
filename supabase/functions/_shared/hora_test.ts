import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { formatarHora } from "./hora.ts";

Deno.test("formatarHora: tira os segundos e o :00", () => {
  assertEquals(formatarHora("20:00:00"), "20h");
  assertEquals(formatarHora("20:30:00"), "20h30");
  assertEquals(formatarHora("09:05"), "9h05");
  assertEquals(formatarHora("00:00:00"), "0h");
});

Deno.test("formatarHora: vazio ou inválido vira texto vazio", () => {
  for (const v of [null, undefined, "", "   ", "25:00:00", "20:60", "abc", "20h"]) assertEquals(formatarHora(v), "");
});

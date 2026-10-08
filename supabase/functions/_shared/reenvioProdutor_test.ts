// Rodar: deno test supabase/functions/_shared/reenvioProdutor_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { reenvioDoProdutor } from "./reenvioProdutor.ts";

const base = { orderUserId: "comprador", producerId: "prod", callerId: "prod", emailType: "ticket_delivery", mfa: true };
Deno.test("dono do evento, ticket_delivery e 2FA: passa", () => assertEquals(reenvioDoProdutor(base), true));
Deno.test("produtor de outro evento: nega", () => assertEquals(reenvioDoProdutor({ ...base, producerId: "outro" }), false));
Deno.test("sem 2FA: nega", () => assertEquals(reenvioDoProdutor({ ...base, mfa: false }), false));
Deno.test("outro tipo de e-mail: nega", () => assertEquals(reenvioDoProdutor({ ...base, emailType: "order_confirmation" }), false));
Deno.test("evento sem dono: nega", () => assertEquals(reenvioDoProdutor({ ...base, producerId: null }), false));
Deno.test("o próprio comprador não é 'produtor'", () => assertEquals(reenvioDoProdutor({ ...base, orderUserId: "prod" }), false));

CREATE TABLE "gastos_por_completar" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gastos_por_completar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha" date NOT NULL,
	"categoria_id" integer NOT NULL,
	"nota" text,
	"monto_centavos" bigint,
	"moneda" "moneda",
	"referencia" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gastos_por_completar_monto" CHECK (("gastos_por_completar"."monto_centavos" is null and "gastos_por_completar"."moneda" is null) or ("gastos_por_completar"."monto_centavos" > 0 and "gastos_por_completar"."moneda"::text in ('VES', 'USD')))
);
--> statement-breakpoint
ALTER TABLE "gastos_por_completar" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gastos_por_completar" ADD CONSTRAINT "gastos_por_completar_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gastos_por_completar_referencia_unica" ON "gastos_por_completar" USING btree ("referencia");
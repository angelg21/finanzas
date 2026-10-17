CREATE TABLE "etiquetas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "etiquetas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"clave" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "etiquetas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "etiqueta_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "etiquetas_clave_unica" ON "etiquetas" USING btree ("clave");--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_etiqueta_id_etiquetas_id_fk" FOREIGN KEY ("etiqueta_id") REFERENCES "public"."etiquetas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_etiqueta_idx" ON "movimientos" USING btree ("etiqueta_id");--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_etiqueta_solo_gasto_ingreso" CHECK ("movimientos"."etiqueta_id" is null or "movimientos"."tipo"::text in ('gasto', 'ingreso'));
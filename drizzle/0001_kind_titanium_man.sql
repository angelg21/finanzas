ALTER TYPE "public"."tipo_sobre" ADD VALUE 'fondo';--> statement-breakpoint
CREATE TABLE "partidas_sobre" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "partidas_sobre_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sobre_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"veces_por_anio" integer DEFAULT 1 NOT NULL,
	"mes" integer,
	"nota" text,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partidas_sobre_monto_positivo" CHECK ("partidas_sobre"."monto_centavos" > 0 and "partidas_sobre"."veces_por_anio" > 0),
	CONSTRAINT "partidas_sobre_mes_valido" CHECK ("partidas_sobre"."mes" is null or ("partidas_sobre"."mes" between 1 and 12))
);
--> statement-breakpoint
ALTER TABLE "partidas_sobre" ADD CONSTRAINT "partidas_sobre_sobre_id_sobres_id_fk" FOREIGN KEY ("sobre_id") REFERENCES "public"."sobres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partidas_sobre_sobre_idx" ON "partidas_sobre" USING btree ("sobre_id");
CREATE TYPE "public"."moneda" AS ENUM('USD', 'USDT', 'USDC', 'VES');--> statement-breakpoint
CREATE TYPE "public"."origen_movimiento" AS ENUM('manual', 'telegram', 'importado', 'binance');--> statement-breakpoint
CREATE TYPE "public"."tipo_categoria" AS ENUM('ingreso', 'gasto');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta" AS ENUM('exchange', 'billetera', 'efectivo', 'banco', 'transito');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('ingreso', 'gasto', 'transferencia', 'reasignacion');--> statement-breakpoint
CREATE TYPE "public"."tipo_regla" AS ENUM('fijo', 'porcentaje');--> statement-breakpoint
CREATE TYPE "public"."tipo_sobre" AS ENUM('por_asignar', 'gastos', 'familia', 'emergencia', 'meta', 'inversion');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categorias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"tipo" "tipo_categoria" NOT NULL,
	"padre_id" integer,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cuentas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"moneda" "moneda" NOT NULL,
	"tipo" "tipo_cuenta" NOT NULL,
	"es_propia" boolean DEFAULT true NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha" date NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"moneda" "moneda" NOT NULL,
	"monto_usd_centavos" bigint NOT NULL,
	"monto_destino_centavos" bigint,
	"moneda_destino" "moneda",
	"tasa" numeric(14, 4),
	"cuenta_origen_id" integer,
	"cuenta_destino_id" integer,
	"sobre_origen_id" integer,
	"sobre_destino_id" integer,
	"categoria_id" integer,
	"nota" text,
	"origen" "origen_movimiento" DEFAULT 'manual' NOT NULL,
	"referencia_externa" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_monto_positivo" CHECK ("movimientos"."monto_centavos" > 0 and "movimientos"."monto_usd_centavos" > 0),
	CONSTRAINT "movimientos_forma_por_tipo" CHECK (case "movimientos"."tipo"
        when 'ingreso' then
          "movimientos"."cuenta_destino_id" is not null and "movimientos"."sobre_destino_id" is not null and "movimientos"."categoria_id" is not null
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."sobre_origen_id" is null
        when 'gasto' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."sobre_origen_id" is not null and "movimientos"."categoria_id" is not null
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null
        when 'transferencia' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."cuenta_destino_id" is not null
          and "movimientos"."cuenta_origen_id" <> "movimientos"."cuenta_destino_id"
          and "movimientos"."sobre_origen_id" is null and "movimientos"."sobre_destino_id" is null
        when 'reasignacion' then
          "movimientos"."sobre_origen_id" is not null and "movimientos"."sobre_destino_id" is not null
          and "movimientos"."sobre_origen_id" <> "movimientos"."sobre_destino_id"
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."cuenta_destino_id" is null
      end)
);
--> statement-breakpoint
CREATE TABLE "reglas_reparto" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reglas_reparto_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orden" integer NOT NULL,
	"sobre_id" integer NOT NULL,
	"tipo" "tipo_regla" NOT NULL,
	"valor" integer NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reglas_reparto_valor_positivo" CHECK ("reglas_reparto"."valor" > 0)
);
--> statement-breakpoint
CREATE TABLE "sobres" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sobres_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"tipo" "tipo_sobre" NOT NULL,
	"tope_centavos" bigint,
	"fecha_objetivo" date,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_padre_id_categorias_id_fk" FOREIGN KEY ("padre_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_origen_id_cuentas_id_fk" FOREIGN KEY ("cuenta_origen_id") REFERENCES "public"."cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_destino_id_cuentas_id_fk" FOREIGN KEY ("cuenta_destino_id") REFERENCES "public"."cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_sobre_origen_id_sobres_id_fk" FOREIGN KEY ("sobre_origen_id") REFERENCES "public"."sobres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_sobre_destino_id_sobres_id_fk" FOREIGN KEY ("sobre_destino_id") REFERENCES "public"."sobres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_reparto" ADD CONSTRAINT "reglas_reparto_sobre_id_sobres_id_fk" FOREIGN KEY ("sobre_id") REFERENCES "public"."sobres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_tipo_nombre_unico" ON "categorias" USING btree ("tipo","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_nombre_unico" ON "cuentas" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "movimientos_fecha_idx" ON "movimientos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "movimientos_cuenta_origen_idx" ON "movimientos" USING btree ("cuenta_origen_id");--> statement-breakpoint
CREATE INDEX "movimientos_cuenta_destino_idx" ON "movimientos" USING btree ("cuenta_destino_id");--> statement-breakpoint
CREATE INDEX "movimientos_sobre_origen_idx" ON "movimientos" USING btree ("sobre_origen_id");--> statement-breakpoint
CREATE INDEX "movimientos_sobre_destino_idx" ON "movimientos" USING btree ("sobre_destino_id");--> statement-breakpoint
CREATE INDEX "movimientos_categoria_idx" ON "movimientos" USING btree ("categoria_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_origen_referencia_unico" ON "movimientos" USING btree ("origen","referencia_externa") WHERE "movimientos"."referencia_externa" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reglas_reparto_sobre_unico" ON "reglas_reparto" USING btree ("sobre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sobres_nombre_unico" ON "sobres" USING btree ("nombre");
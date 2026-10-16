CREATE TYPE "public"."sentido_deuda" AS ENUM('debo', 'me_deben');--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'pago_deuda';--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'prestamo';--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'cobro_prestamo';--> statement-breakpoint
ALTER TYPE "public"."tipo_sobre" ADD VALUE 'deudas';--> statement-breakpoint
CREATE TABLE "deudas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deudas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sentido" "sentido_deuda" NOT NULL,
	"persona" text NOT NULL,
	"monto_inicial_centavos" bigint DEFAULT 0 NOT NULL,
	"fecha_prevista" date,
	"cuenta_prevista_id" integer,
	"nota" text,
	"referencia" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deudas_monto_valido" CHECK ("deudas"."monto_inicial_centavos" > 0 or ("deudas"."monto_inicial_centavos" = 0 and "deudas"."sentido"::text = 'me_deben')),
	CONSTRAINT "deudas_cuenta_prevista_solo_debo" CHECK ("deudas"."cuenta_prevista_id" is null or "deudas"."sentido"::text = 'debo')
);
--> statement-breakpoint
ALTER TABLE "deudas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_forma_por_tipo";--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "deuda_id" integer;--> statement-breakpoint
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_cuenta_prevista_id_cuentas_id_fk" FOREIGN KEY ("cuenta_prevista_id") REFERENCES "public"."cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deudas_referencia_unica" ON "deudas" USING btree ("referencia") WHERE "deudas"."referencia" is not null;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_deuda_id_deudas_id_fk" FOREIGN KEY ("deuda_id") REFERENCES "public"."deudas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_deuda_idx" ON "movimientos" USING btree ("deuda_id");--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_forma_por_tipo" CHECK (case "movimientos"."tipo"::text
        when 'ingreso' then
          "movimientos"."cuenta_destino_id" is not null and "movimientos"."sobre_destino_id" is not null and "movimientos"."categoria_id" is not null
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."sobre_origen_id" is null and "movimientos"."deuda_id" is null
        when 'gasto' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."sobre_origen_id" is not null and "movimientos"."categoria_id" is not null
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null and "movimientos"."deuda_id" is null
        when 'transferencia' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."cuenta_destino_id" is not null
          and "movimientos"."cuenta_origen_id" <> "movimientos"."cuenta_destino_id"
          and "movimientos"."sobre_origen_id" is null and "movimientos"."sobre_destino_id" is null and "movimientos"."deuda_id" is null
        when 'reasignacion' then
          "movimientos"."sobre_origen_id" is not null and "movimientos"."sobre_destino_id" is not null
          and "movimientos"."sobre_origen_id" <> "movimientos"."sobre_destino_id"
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."cuenta_destino_id" is null and "movimientos"."deuda_id" is null
        when 'pago_deuda' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."sobre_origen_id" is not null and "movimientos"."deuda_id" is not null
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null and "movimientos"."categoria_id" is null
        when 'prestamo' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."sobre_origen_id" is not null and "movimientos"."deuda_id" is not null
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null and "movimientos"."categoria_id" is null
        when 'cobro_prestamo' then
          "movimientos"."cuenta_destino_id" is not null and "movimientos"."sobre_destino_id" is not null and "movimientos"."deuda_id" is not null
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."sobre_origen_id" is null and "movimientos"."categoria_id" is null
        else false
      end);
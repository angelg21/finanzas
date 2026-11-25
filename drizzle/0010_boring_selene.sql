ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_forma_por_tipo";--> statement-breakpoint
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
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null
        when 'prestamo' then
          "movimientos"."cuenta_origen_id" is not null and "movimientos"."sobre_origen_id" is not null and "movimientos"."deuda_id" is not null
          and "movimientos"."cuenta_destino_id" is null and "movimientos"."sobre_destino_id" is null and "movimientos"."categoria_id" is null
        when 'cobro_prestamo' then
          "movimientos"."cuenta_destino_id" is not null and "movimientos"."sobre_destino_id" is not null and "movimientos"."deuda_id" is not null
          and "movimientos"."cuenta_origen_id" is null and "movimientos"."sobre_origen_id" is null and "movimientos"."categoria_id" is null
        else false
      end);
import { CircleAlert } from "lucide-react";
import { Avatar, Cifra, FilaLista, Pildora, iniciales } from "@/components/ui";
import type { DeudaConPendiente } from "@/db/deudas";
import { formatearCifra } from "@/lib/dinero";
import { plazoDeDeuda } from "@/lib/plazos";

/**
 * Una deuda en /deudas (spec 005, pantallas): las iniciales de la persona, su nombre, cuándo vence y con qué cuenta se
 * piensa pagar; a la derecha lo pendiente y, debajo, de cuánto. Si el dinero no está donde se piensa pagar, el aviso
 * de liquidez debajo de la fila. Pagada, solo el total.
 */
export function FilaDeuda({ deuda, hoy, aviso }: { deuda: DeudaConPendiente; hoy: string; aviso?: string | null }) {
  const total = deuda.montoInicialCentavos + deuda.prestadoCentavos;
  const pagada = deuda.estado === "pagada";
  const cuenta =
    deuda.cuentaPrevista && deuda.monedaPrevista ? `${deuda.cuentaPrevista} ${deuda.monedaPrevista}` : null;
  const subtitulo = pagada
    ? deuda.sentido === "debo"
      ? "pagada"
      : "cobrada"
    : [plazoDeDeuda(deuda.fechaPrevista, hoy), cuenta].filter(Boolean).join(" · ");
  return (
    <div className="border-t border-tarjeta-borde first:border-t-0">
      <FilaLista
        href={`/deudas/${deuda.id}`}
        avatar={<Avatar texto={iniciales(deuda.persona)} />}
        titulo={deuda.persona}
        subtitulo={subtitulo}
        derecha={
          pagada ? (
            <Cifra centavos={total} tono="texto-3" />
          ) : (
            <>
              <Cifra centavos={deuda.pendienteCentavos} />
              <span className="tabular text-[12px] text-texto-3">de {formatearCifra(total)}</span>
            </>
          )
        }
      />
      {aviso ? (
        <div className="pb-2.5 pl-14">
          <Pildora tono="negativa" className="text-left">
            <CircleAlert size={13} aria-hidden className="shrink-0" />
            {aviso}
          </Pildora>
        </div>
      ) : null}
    </div>
  );
}
